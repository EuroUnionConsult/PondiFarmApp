"""Tempo e bem-estar da quinta: previsão, stress térmico (THI) e avisos.

Fontes (todas sem chave):
- Previsão: modelo europeu ECMWF IFS, via Open-Meteo.
- UV e qualidade do ar: Copernicus Atmosphere Monitoring Service (CAMS), via Open-Meteo.
- Resumo da estação: reanálise ERA5 (Copernicus Climate Change Service), via Open-Meteo.

O cálculo do THI e dos avisos fica AQUI, não nos clientes: a app e a versão web
mostram exatamente os mesmos avisos. Um pedido por quinta a cada 30 min (cache em
memória por coordenadas), não um por telemóvel.
"""

from __future__ import annotations

import email.utils
import hashlib
import logging
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from urllib.parse import urlsplit

import httpx

from services import pt_postcodes

log = logging.getLogger("pondifarm.weather")

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "PondiFarm/0.10 (+https://pondifarmdesk.trazzidely.com.br)"

FORECAST_TTL = 30 * 60
SEASON_TTL = 24 * 60 * 60
PLACES_TTL = 7 * 24 * 60 * 60
# Previsão antiga ainda é útil se o Open-Meteo falhar: serve-se marcada `stale`.
STALE_MAX = 12 * 60 * 60
SEASON_RETRY_AFTER = 30 * 60
TIMEOUT = 10.0

# Repetições: 4 tentativas no máximo, recuo exponencial com jitter, tempo total limitado.
MAX_ATTEMPTS = 4
BACKOFF_BASE = 0.5
BACKOFF_CAP = 4.0
TOTAL_BUDGET = 20.0
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
# Política do Nominatim: no máximo 1 pedido por segundo (para todo o processo).
NOMINATIM_MIN_INTERVAL = 1.0

# Livestock Weather Safety Index (LCI/USDA) para bovinos de carne.
THI_ALERT, THI_DANGER, THI_EMERGENCY = 75.0, 79.0, 84.0

_cache: dict[
    tuple, tuple[float, float, object]
] = {}  # key -> (expira, guardado, valor)
_lock = threading.Lock()
_nominatim_lock = threading.Lock()
CACHE_MAX_ENTRIES = 2000
CACHE_KEEP = 1500
_nominatim_last = 0.0
_season_pending: set[tuple] = set()
_season_failed: dict[tuple, float] = {}

# Pontos de injeção para os testes (sem rede, sem esperas reais).
_transport: httpx.BaseTransport | None = None
_sleep = time.sleep
_clock = time.monotonic


def _spawn(fn) -> None:
    threading.Thread(target=fn, daemon=True, name="weather-bg").start()


class UpstreamError(httpx.HTTPError):
    """Falha definitiva de uma fonte externa, depois das repetições."""

    def __init__(self, provider: str, endpoint: str, detail: str, status: int | None):
        super().__init__(f"{provider} {endpoint}: {detail}")
        self.provider, self.endpoint, self.detail, self.status = (
            provider,
            endpoint,
            detail,
            status,
        )


def round_coord(v: float) -> float:
    """~1 km: chega para a previsão e não grava o ponto exato da exploração."""
    return round(float(v), 2)


def thi(temp_c: float, rh: float) -> float:
    """Índice de temperatura e humidade (NRC 1971), o usado para bovinos."""
    return (1.8 * temp_c + 32) - (0.55 - 0.0055 * rh) * (1.8 * temp_c - 26)


def thi_band(x: float) -> str:
    if x >= THI_EMERGENCY:
        return "emergency"
    if x >= THI_DANGER:
        return "danger"
    if x >= THI_ALERT:
        return "alert"
    return "normal"


def weather_kind(
    code: int | None,
    rain_mm: float,
    pop: int | None,
    thi_v: float,
    gust: float,
    is_day: bool,
) -> str:
    """Que ícone mostrar: trovoada, chuva, calor forte, vento, noite, limpo/nublado."""
    c = code if code is not None else 1
    if c >= 95:
        return "storm"
    if rain_mm > 0.2 or (pop is not None and pop >= 60) or 51 <= c <= 82:
        return "rain"
    if thi_v >= THI_DANGER:
        return "hot"
    if gust >= 45:
        return "wind"
    if not is_day:
        return "night"
    return "sun" if c <= 2 else "cloudy"  # 2 = parcialmente nublado: ainda sol


def _provider(url: str) -> tuple[str, str]:
    u = urlsplit(url)
    host = u.hostname or "?"
    name = "nominatim" if "nominatim" in host else host.split(".")[0]
    return name, u.path or "/"


def _retry_after(r: httpx.Response) -> float | None:
    v = r.headers.get("Retry-After")
    if not v:
        return None
    try:
        return max(0.0, float(v))
    except ValueError:
        pass
    try:
        dt = email.utils.parsedate_to_datetime(v)
        return max(0.0, dt.timestamp() - time.time())
    except (TypeError, ValueError):
        return None


def _nominatim_wait(remaining: float) -> bool:
    """Espaça os pedidos ao Nominatim ≥1 s (política de uso), entre todos os threads.

    Reserva a vez sob o lock e dorme FORA dele, para não prender outros threads.
    Devolve False (sem esperar) se a vez reservável já não cabe no tempo que resta."""
    global _nominatim_last
    with _nominatim_lock:
        now = _clock()
        slot = max(now, _nominatim_last + NOMINATIM_MIN_INTERVAL)
        wait = slot - now
        if wait > remaining - 0.2:
            return False
        _nominatim_last = slot
    if wait > 0:
        _sleep(wait)
    return True


def _get(
    url: str,
    params: dict,
    headers: dict | None = None,
    *,
    attempts: int = MAX_ATTEMPTS,
    budget: float = TOTAL_BUDGET,
) -> dict | list:
    """GET JSON com repetições em timeout, erro de ligação, 429 e 5xx.

    Cada falha fica no log (fonte, endpoint, estado/tipo de erro, tentativa, duração).
    Os parâmetros não vão para o log: as coordenadas já vêm arredondadas, mas as
    pesquisas são texto livre do utilizador."""
    provider, endpoint = _provider(url)
    deadline = _clock() + budget
    last: Exception | None = None
    attempt = 0
    for attempt in range(1, attempts + 1):
        remaining = deadline - _clock()
        if remaining <= 0.2:
            break
        if provider == "nominatim" and not _nominatim_wait(remaining):
            break
        t0 = _clock()
        retry_in: float | None = None
        status: int | None = None
        try:
            with httpx.Client(
                timeout=min(TIMEOUT, remaining),
                headers={"User-Agent": USER_AGENT, **(headers or {})},
                transport=_transport,
            ) as c:
                r = c.get(url, params=params)
            status = r.status_code
            if status in RETRY_STATUSES:
                retry_in = _retry_after(r)
                raise httpx.HTTPStatusError(
                    f"HTTP {status}", request=r.request, response=r
                )
            r.raise_for_status()
            data = r.json()
            if attempt > 1:
                log.info(
                    "upstream ok after retry",
                    extra={
                        "provider": provider,
                        "endpoint": endpoint,
                        "attempt": attempt,
                        "duration_ms": round((_clock() - t0) * 1000),
                    },
                )
            return data
        except (
            httpx.TimeoutException,
            httpx.TransportError,
            httpx.HTTPStatusError,
        ) as e:
            last = e
            retryable = status is None or status in RETRY_STATUSES
            log.warning(
                "upstream failure",
                extra={
                    "provider": provider,
                    "endpoint": endpoint,
                    "status": status,
                    "error_type": type(e).__name__,
                    "attempt": attempt,
                    "max_attempts": attempts,
                    "duration_ms": round((_clock() - t0) * 1000),
                    "retryable": retryable,
                },
            )
            if not retryable or attempt == attempts:
                break
            delay = min(BACKOFF_CAP, BACKOFF_BASE * 2 ** (attempt - 1))
            delay = delay / 2 + random.uniform(0, delay / 2)  # jitter
            if retry_in is not None:
                delay = max(delay, retry_in)
            if _clock() + delay >= deadline:
                log.warning(
                    "upstream retry skipped: time budget",
                    extra={
                        "provider": provider,
                        "endpoint": endpoint,
                        "wait_s": round(delay, 1),
                    },
                )
                break
            _sleep(delay)
        except ValueError as e:  # JSON inválido
            last = e
            log.warning(
                "upstream bad payload",
                extra={
                    "provider": provider,
                    "endpoint": endpoint,
                    "status": status,
                    "attempt": attempt,
                },
            )
            break
    status = (
        last.response.status_code if isinstance(last, httpx.HTTPStatusError) else None
    )
    detail = type(last).__name__ if last else "budget exhausted"
    log.error(
        "upstream failed",
        extra={
            "provider": provider,
            "endpoint": endpoint,
            "status": status,
            "error_type": detail,
            "attempts_made": attempt,
        },
    )
    raise UpstreamError(provider, endpoint, detail, status) from last


def _cached(key: tuple, ttl: int, fetch, *, stale_max: float = 0):
    """Devolve (valor, stale). Se `fetch` falhar e houver um valor guardado há menos
    de `stale_max` segundos, devolve-o marcado como antigo em vez de falhar."""
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[2], False
    try:
        value = fetch()
    except (httpx.HTTPError, KeyError, ValueError) as e:
        if hit and now - hit[1] <= stale_max:
            log.warning(
                "serving stale data",
                extra={
                    "cache": key[0],
                    "age_s": round(now - hit[1]),
                    "error_type": type(e).__name__,
                },
            )
            return hit[2], True
        raise
    with _lock:
        _cache[key] = (now + ttl, now, value)
        if len(_cache) > CACHE_MAX_ENTRIES:
            # Pesquisas são texto livre: limitar a memória. Saem primeiro as mais antigas.
            for k in sorted(_cache, key=lambda k: _cache[k][1])[
                : len(_cache) - CACHE_KEEP
            ]:
                del _cache[k]
    return value, False


def _windows(flags: list[bool]) -> list[tuple[int, int]]:
    out, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(flags) - 1))
    return out


def _end_label(times: list[str], b: int) -> str:
    """Uma janela que acaba na hora b termina no início da hora seguinte."""
    return times[b + 1][11:16] if b + 1 < len(times) else "24:00"


def build_alerts(hours: dict) -> list[dict]:
    """Avisos das próximas 24 h. `hours` = listas alinhadas (time, temp, rh, rain, pop, gust, thi)."""
    t, alerts = hours["time"], []

    def alert(kind, severity, title, text, a, b):
        # id estável: a mesma janela não volta a acender o ponto laranja depois de lida.
        key = f"{kind}|{t[a][:13]}"
        alerts.append(
            {
                "id": hashlib.sha256(key.encode()).hexdigest()[:12],
                "kind": kind,
                "severity": severity,
                "title": title,
                "text": text,
                "start": t[a][11:16],
                "end": _end_label(t, b),
            }
        )

    for a, b in _windows([x >= THI_ALERT for x in hours["thi"]]):
        seg = hours["thi"][a : b + 1]
        mx = max(seg)
        at = a + seg.index(mx)
        band = thi_band(mx)
        alert(
            "heat",
            "danger" if mx >= THI_DANGER else "warning",
            f"Heat stress from {t[a][11:16]} to {_end_label(t, b)}",
            f"THI peaks at {round(mx)} at {t[at][11:16]} ({band.capitalize()}). Make sure every animal "
            "has shade and plenty of water; avoid handling, weighing or transport in these hours.",
            a,
            b,
        )
    pops = hours.get("pop") or [None] * len(t)
    rainy = [
        (p is not None and p >= 50) or (r or 0) >= 0.5
        for p, r in zip(pops, hours["rain"])
    ]
    for a, b in _windows(rainy):
        mm = sum((r or 0) for r in hours["rain"][a : b + 1])
        known = [p for p in pops[a : b + 1] if p is not None]
        pmax = max(known) if known else None
        alert(
            "rain",
            "warning",
            f"Rain {'likely ' if pmax is not None else ''}from {t[a][11:16]} to {_end_label(t, b)}",
            f"{str(pmax) + '% chance, ' if pmax is not None else ''}about {mm:.1f} mm. Plan scans and moves "
            "before it starts; check that low pens and feeding areas drain.",
            a,
            b,
        )
    temps = hours["temp"]
    mn = min(temps)
    if mn <= 5:
        i = temps.index(mn)
        alert(
            "cold",
            "warning",
            f"Cold night: {round(mn)} °C at {t[i][11:16]}",
            "Young calves lose heat fast. Dry bedding and shelter from the wind.",
            i,
            i,
        )
    g = max(hours["gust"])
    if g >= 50:
        i = hours["gust"].index(g)
        alert(
            "wind",
            "warning",
            f"Strong gusts, up to {round(g)} km/h at {t[i][11:16]}",
            "Secure loose sheets and gates; animals tend to bunch in open pastures.",
            i,
            i,
        )
    return alerts


def _season(lat: float, lon: float, today: date) -> dict | None:
    """Dias com stress térmico desde 1 de junho (ERA5). Fora do verão, o verão anterior."""
    year = today.year if today >= date(today.year, 6, 15) else today.year - 1
    start = date(year, 6, 1)
    end = min(
        date(year, 10, 15), today - timedelta(days=6)
    )  # o ERA5 chega com ~5 dias de atraso
    if end <= start:
        return None

    def fetch():
        d = _get(
            ARCHIVE_URL,
            {
                "latitude": lat,
                "longitude": lon,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "hourly": "temperature_2m,relative_humidity_2m",
                "models": "era5",
                "timezone": "auto",
            },
        )
        h = d.get("hourly") or {}
        peak: dict[str, float] = {}
        for ts, tc, rh in zip(
            h.get("time", []),
            h.get("temperature_2m", []),
            h.get("relative_humidity_2m", []),
        ):
            if tc is None or rh is None:
                continue
            peak[ts[:10]] = max(peak.get(ts[:10], 0.0), thi(tc, rh))
        return {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "alertDays": sum(1 for v in peak.values() if v >= THI_ALERT),
            "dangerDays": sum(1 for v in peak.values() if v >= THI_DANGER),
        }

    key = ("season", lat, lon, start, end)
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[2]
        # O ERA5 é lento (meses de horas): nunca bloqueia a previsão. O primeiro pedido
        # para um sítio novo devolve `season: null` e o cálculo segue em segundo plano.
        if key in _season_pending or _season_failed.get(key, 0) > now:
            return hit[2] if hit else None
        _season_pending.add(key)

    def run():
        try:
            _cached(key, SEASON_TTL, fetch)
        except (httpx.HTTPError, KeyError, ValueError) as e:
            log.warning("season summary failed", extra={"error_type": type(e).__name__})
            with _lock:
                _season_failed[key] = time.time() + SEASON_RETRY_AFTER
        finally:
            with _lock:
                _season_pending.discard(key)

    _spawn(run)
    return hit[2] if hit else None


def _day_kind(h: dict, day: str, code: int, pop: int | None, tmax: float) -> str:
    """Ícone do dia. O código diário do ECMWF é o PIOR momento do dia (uma hora
    encoberta põe o dia todo «nublado»); aqui usa-se o estado mais frequente nas
    horas de dia, e chuva/trovoada/calor quando de facto contam."""
    if code >= 95:
        return "storm"
    if (pop or 0) >= 50 or 51 <= code <= 82:
        return "rain"
    if tmax >= 32:
        return "hot"
    codes = [
        c
        for t, c, dayl in zip(
            h["time"], h["weather_code"], h.get("is_day", [1] * len(h["time"]))
        )
        if t.startswith(day) and dayl
    ]
    if not codes:
        return "sun" if code <= 2 else "cloudy"
    sunny = sum(1 for c in codes if c <= 2)
    return "sun" if sunny >= len(codes) / 2 else "cloudy"


def replay_enabled() -> bool:
    """Demonstração: repetir um dia real do ERA5 como se fosse hoje. Desligado em produção."""
    import os

    return os.environ.get("WEATHER_REPLAY") == "1"


def _replay_raw(lat: float, lon: float, day: str) -> dict:
    """Constrói a mesma forma da previsão a partir das horas reais desse dia (ERA5),
    com «agora» às 15:00. Sem probabilidade de chuva: o ERA5 só sabe quanto caiu."""
    d = _get(
        ARCHIVE_URL,
        {
            "latitude": lat,
            "longitude": lon,
            "start_date": day,
            "end_date": day,
            "models": "era5",
            "timezone": "auto",
            "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,"
            "weather_code,wind_speed_10m,wind_gusts_10m,is_day",
        },
    )
    h = d["hourly"]
    i = 15
    cur = {"time": h["time"][i], **{k: h[k][i] for k in h if k != "time"}}
    hourly = {**h, "precipitation_probability": [None] * len(h["time"])}
    t = h["temperature_2m"]
    daily = {
        "time": [day],
        "temperature_2m_max": [max(t)],
        "temperature_2m_min": [min(t)],
        "precipitation_probability_max": [None],
        "weather_code": [sorted(h["weather_code"])[len(h["weather_code"]) // 2]],
    }
    return {
        "f": {
            "hourly": hourly,
            "current": cur,
            "daily": daily,
            "timezone": d.get("timezone"),
        },
        "aq": {},
        "at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "replay": day,
    }


def forecast_for(
    lat: float, lon: float, label: str | None, replay_day: str | None = None
) -> dict:
    """Tudo o que a página e o ícone precisam, já calculado."""
    lat, lon = round_coord(lat), round_coord(lon)

    def fetch():
        # Previsão e qualidade do ar em paralelo; a do ar tem orçamento curto e é opcional.
        with ThreadPoolExecutor(max_workers=2) as ex:
            fut_aq = ex.submit(
                _get,
                AIR_URL,
                {
                    "latitude": lat,
                    "longitude": lon,
                    "timezone": "auto",
                    "current": "uv_index,european_aqi",
                },
                attempts=2,
                budget=6.0,
            )
            fut_f = ex.submit(
                _get,
                FORECAST_URL,
                {
                    "latitude": lat,
                    "longitude": lon,
                    "models": "ecmwf_ifs025",
                    "timezone": "auto",
                    "forecast_days": 7,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,"
                    "wind_speed_10m,wind_gusts_10m,is_day",
                    "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,"
                    "wind_speed_10m,wind_gusts_10m,weather_code,is_day",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
                },
            )
            try:
                aq = fut_aq.result()
            except httpx.HTTPError:
                aq = {}  # sem UV/AQI, a previsão continua válida
            f = fut_f.result()
        if not isinstance(f, dict) or "hourly" not in f or "current" not in f:
            raise ValueError("forecast payload without hourly/current")
        return {
            "f": f,
            "aq": aq if isinstance(aq, dict) else {},
            "at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }

    replay = replay_day if (replay_day and replay_enabled()) else None
    raw, stale = (
        _cached(
            ("replay", lat, lon, replay),
            SEASON_TTL,
            lambda: _replay_raw(lat, lon, replay),
        )
        if replay
        else _cached(("fc", lat, lon), FORECAST_TTL, fetch, stale_max=STALE_MAX)
    )
    f, aq = raw["f"], raw["aq"]
    h, cur = f["hourly"], f["current"]
    # As próximas 24 h a partir da hora atual (hora local da quinta).
    now_hour = cur["time"][:13]
    i0 = next((i for i, t in enumerate(h["time"]) if t[:13] >= now_hour), 0)
    sl = slice(i0, i0 + 24)
    temps, rh = h["temperature_2m"][sl], h["relative_humidity_2m"][sl]
    hours = {
        "time": h["time"][sl],
        "temp": temps,
        "rh": rh,
        "rain": h["precipitation"][sl],
        "pop": h.get("precipitation_probability", [None] * len(h["time"]))[sl],
        "wind": h["wind_speed_10m"][sl],
        "gust": h["wind_gusts_10m"][sl],
        "code": h["weather_code"][sl],
        "isDay": h.get("is_day", [1] * len(h["time"]))[sl],
    }
    hours["thi"] = [round(thi(t, r), 1) for t, r in zip(temps, rh)]
    now_thi = thi(cur["temperature_2m"], cur["relative_humidity_2m"])
    daily = f["daily"]
    days = [
        {
            "date": d,
            "max": mx,
            "min": mn,
            "pop": p,
            "code": c,
            "kind": _day_kind(h, d, c, p, mx),
        }
        for d, mx, mn, p, c in zip(
            daily["time"],
            daily["temperature_2m_max"],
            daily["temperature_2m_min"],
            daily["precipitation_probability_max"],
            daily["weather_code"],
        )
    ]
    current = {
        "time": cur["time"],
        "temp": cur["temperature_2m"],
        "feelsLike": cur["apparent_temperature"],
        "rh": cur["relative_humidity_2m"],
        "wind": cur["wind_speed_10m"],
        "gust": cur["wind_gusts_10m"],
        "code": cur["weather_code"],
        "isDay": bool(cur.get("is_day", 1)),
        "thi": round(now_thi, 1),
        "thiBand": thi_band(now_thi),
        "uv": (aq.get("current") or {}).get("uv_index"),
        "aqi": (aq.get("current") or {}).get("european_aqi"),
    }
    current["kind"] = weather_kind(
        current["code"],
        cur.get("precipitation") or 0,
        hours["pop"][0] if hours["pop"] else None,
        now_thi,
        current["gust"] or 0,
        current["isDay"],
    )
    return {
        "location": {"lat": lat, "lon": lon, "label": label},
        "timezone": f.get("timezone"),
        "updatedAt": raw["at"],
        # true = o Open-Meteo falhou agora; isto é a última previsão boa (ver updatedAt).
        "stale": stale,
        "current": current,
        "hours": hours,
        "days": days,
        "thiPeak": max(hours["thi"]) if hours["thi"] else None,
        "alerts": build_alerts(hours),
        "season": _season(
            lat, lon, date.today() if replay else date.fromisoformat(cur["time"][:10])
        ),
        "replay": raw.get("replay"),
        "sources": {
            "forecast": "ECMWF IFS (via Open-Meteo)",
            "air": "Copernicus CAMS (via Open-Meteo)",
            "season": "ERA5, Copernicus Climate Change Service (via Open-Meteo)",
            "thi": "Livestock Weather Safety Index (beef cattle)",
        },
    }


def _place(label: str, lat: float, lon: float) -> dict:
    return {"label": label, "lat": round_coord(lat), "lon": round_coord(lon)}


def _nominatim_search(params: dict) -> list[dict]:
    """Nominatim com cache (a política de uso pede cache e ≤1 pedido/s)."""
    key = ("nominatim", tuple(sorted(params.items())))

    def fetch():
        res = _get(
            f"{NOMINATIM_URL}/search",
            {**params, "format": "jsonv2", "addressdetails": 1, "limit": 5},
        )
        return [
            _place(
                _label_from_address(r.get("address") or {}, r.get("display_name", "")),
                float(r["lat"]),
                float(r["lon"]),
            )
            for r in (res if isinstance(res, list) else [])
        ]

    return _cached(key, PLACES_TTL, fetch)[0]


def _dedupe(items: list[dict], limit: int) -> list[dict]:
    out, seen = [], set()
    for it in items:
        k = it["label"].casefold()
        if k not in seen:
            seen.add(k)
            out.append(it)
    return out[:limit]


def search_places(query: str, submit: bool = False) -> list[dict]:
    """Lugar por nome ou código postal português.

    Código postal (4935-585, 4935 585, 4935585 ou 4935): tabela offline da GeoNames
    primeiro; o Nominatim só se o código não estiver lá.
    Nome: Open-Meteo (Portugal primeiro) + tabela offline, que conhece freguesias
    pequenas («Vila Nova de Anha»). Se nada aparecer e o utilizador SUBMETEU a pesquisa
    (Enter/botão), tenta o Nominatim restrito a PT. Nunca em autocompletar: a política
    do Nominatim proíbe-o."""
    q = " ".join((query or "").split())
    if len(q) < 3:
        return []
    pc = pt_postcodes.parse_postcode(q)
    if pc:
        code4, code3 = pc
        found = pt_postcodes.lookup(code4, code3)
        if found:
            return found
        for code in ([f"{code4}-{code3}"] if code3 else []) + [code4]:
            res = _nominatim_search({"postalcode": code, "countrycodes": "pt"})
            if res:
                return res
        return []

    def om():
        res = _get(
            GEOCODE_URL, {"name": q, "count": 10, "language": "en", "format": "json"}
        )
        return (res or {}).get("results") or [] if isinstance(res, dict) else []

    rows = _cached(("geocode", q.casefold()), PLACES_TTL, om)[0]
    rows = sorted(rows, key=lambda r: r.get("country_code") != "PT")  # estável
    named = [
        _place(
            ", ".join(
                x for x in (r.get("name"), r.get("admin1"), r.get("country")) if x
            ),
            r["latitude"],
            r["longitude"],
        )
        for r in rows
    ]
    pt = [p for p, r in zip(named, rows) if r.get("country_code") == "PT"]
    other = [p for p, r in zip(named, rows) if r.get("country_code") != "PT"]
    offline = pt_postcodes.search_name(q)
    out = _dedupe(pt + offline + other, 8)
    if not out and submit:
        out = _nominatim_search({"q": q, "countrycodes": "pt"})
    return out


def _label_from_address(a: dict, fallback: str) -> str:
    place = (
        a.get("city")
        or a.get("town")
        or a.get("village")
        or a.get("municipality")
        or a.get("county")
    )
    region = a.get("state") or a.get("region")
    parts = [p for p in (place, region) if p]
    return " · ".join(parts) if parts else fallback.split(",")[0]


def place_name(lat: float, lon: float) -> str | None:
    """Nome do lugar para um ponto (GPS ou pino no mapa)."""
    lat, lon = round_coord(lat), round_coord(lon)
    try:
        r, _stale = _cached(
            ("reverse", lat, lon),
            PLACES_TTL,
            lambda: _get(
                f"{NOMINATIM_URL}/reverse",
                {
                    "lat": lat,
                    "lon": lon,
                    "zoom": 10,
                    "format": "jsonv2",
                    "addressdetails": 1,
                },
            ),
        )
    except httpx.HTTPError:
        return None  # já ficou no log em _get
    return (
        _label_from_address(r.get("address") or {}, r.get("display_name", ""))
        if isinstance(r, dict)
        else None
    )

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

import hashlib
import re
import threading
import time
from datetime import date, datetime, timedelta

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "PondiFarm/0.9 (+https://pondifarmdesk.trazzidely.com.br)"

FORECAST_TTL = 30 * 60
SEASON_TTL = 24 * 60 * 60
TIMEOUT = httpx.Timeout(10.0)

# Livestock Weather Safety Index (LCI/USDA) para bovinos de carne.
THI_ALERT, THI_DANGER, THI_EMERGENCY = 75.0, 79.0, 84.0

_cache: dict[tuple, tuple[float, dict]] = {}
_lock = threading.Lock()


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


def _get(url: str, params: dict, headers: dict | None = None) -> dict | list:
    with httpx.Client(
        timeout=TIMEOUT, headers={"User-Agent": USER_AGENT, **(headers or {})}
    ) as c:
        r = c.get(url, params=params)
        r.raise_for_status()
        return r.json()


def _cached(key: tuple, ttl: int, fetch):
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    value = fetch()
    with _lock:
        _cache[key] = (now + ttl, value)
    return value


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

    try:
        return _cached(("season", lat, lon, start, end), SEASON_TTL, fetch)
    except httpx.HTTPError:
        return None


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
        f = _get(
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
            aq = _get(
                AIR_URL,
                {
                    "latitude": lat,
                    "longitude": lon,
                    "timezone": "auto",
                    "current": "uv_index,european_aqi",
                },
            )
        except httpx.HTTPError:
            aq = {}
        return {
            "f": f,
            "aq": aq,
            "at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }

    replay = replay_day if (replay_day and replay_enabled()) else None
    raw = (
        _cached(
            ("replay", lat, lon, replay),
            SEASON_TTL,
            lambda: _replay_raw(lat, lon, replay),
        )
        if replay
        else _cached(("fc", lat, lon), FORECAST_TTL, fetch)
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


_PT_POSTCODE = re.compile(r"^\s*(\d{4})-?(\d{3})\s*$")


def search_places(query: str) -> list[dict]:
    """Lugar por nome (Open-Meteo) ou código postal português (OpenStreetMap)."""
    q = (query or "").strip()
    if len(q) < 3:
        return []
    m = _PT_POSTCODE.match(q)
    if m:
        # Código postal PT: o OpenStreetMap nem sempre tem os 7 dígitos; tenta depois só os 4.
        for code in (f"{m.group(1)}-{m.group(2)}", m.group(1)):
            res = _get(
                f"{NOMINATIM_URL}/search",
                {
                    "postalcode": code,
                    "country": "pt",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 5,
                },
            )
            if res:
                return [
                    {
                        "label": _label_from_address(
                            r.get("address") or {}, r.get("display_name", "")
                        ),
                        "lat": round_coord(float(r["lat"])),
                        "lon": round_coord(float(r["lon"])),
                    }
                    for r in res
                ]
        return []
    res = _get(GEOCODE_URL, {"name": q, "count": 6, "language": "en", "format": "json"})
    return [
        {
            "label": ", ".join(
                x for x in (r.get("name"), r.get("admin1"), r.get("country")) if x
            ),
            "lat": round_coord(r["latitude"]),
            "lon": round_coord(r["longitude"]),
        }
        for r in (res.get("results") or [])
    ]


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
    try:
        r = _get(
            f"{NOMINATIM_URL}/reverse",
            {
                "lat": round_coord(lat),
                "lon": round_coord(lon),
                "zoom": 10,
                "format": "jsonv2",
                "addressdetails": 1,
            },
        )
    except httpx.HTTPError:
        return None
    return (
        _label_from_address(r.get("address") or {}, r.get("display_name", ""))
        if isinstance(r, dict)
        else None
    )

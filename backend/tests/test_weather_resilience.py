"""Repetições, logs, previsão antiga em falha, ERA5 fora do caminho crítico e pesquisa
de lugares/códigos postais. Sem rede: todas as respostas vêm de um httpx.MockTransport."""

import os
import unittest
import unittest.mock

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

import httpx  # noqa: E402

from services import pt_postcodes  # noqa: E402
from services import weather_service as wx  # noqa: E402


def _forecast_payload():
    times = [f"2026-11-23T{h:02d}:00" for h in range(24)] + [
        f"2026-11-24T{h:02d}:00" for h in range(24)
    ]
    n = len(times)
    return {
        "timezone": "Europe/Lisbon",
        "current": {
            "time": "2026-11-23T10:00",
            "temperature_2m": 14.0,
            "relative_humidity_2m": 70,
            "apparent_temperature": 13.0,
            "precipitation": 0,
            "weather_code": 1,
            "wind_speed_10m": 8,
            "wind_gusts_10m": 15,
            "is_day": 1,
        },
        "hourly": {
            "time": times,
            "temperature_2m": [14.0] * n,
            "relative_humidity_2m": [70] * n,
            "precipitation_probability": [10] * n,
            "precipitation": [0] * n,
            "wind_speed_10m": [8] * n,
            "wind_gusts_10m": [15] * n,
            "weather_code": [1] * n,
            "is_day": [1] * n,
        },
        "daily": {
            "time": ["2026-11-23", "2026-11-24"],
            "temperature_2m_max": [16, 17],
            "temperature_2m_min": [9, 8],
            "precipitation_probability_max": [10, 20],
            "weather_code": [1, 2],
        },
    }


class Fake:
    """Responde por host; cada handler recebe o pedido e devolve um httpx.Response."""

    def __init__(self, **by_host):
        self.by_host = by_host
        self.calls: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        h = self.by_host.get(request.url.host.split(".")[0]) or self.by_host.get(
            request.url.host
        )
        if h is None:
            return httpx.Response(404, json={})
        return h(request) if callable(h) else h

    def hosts(self):
        return [r.url.host for r in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        wx._cache.clear()
        wx._season_pending.clear()
        wx._season_failed.clear()
        self.sleeps: list[float] = []
        self.now = [1000.0]

        def sleep(s):
            self.sleeps.append(s)
            self.now[0] += s

        patches = [
            unittest.mock.patch.object(wx, "_sleep", sleep),
            unittest.mock.patch.object(wx, "_clock", lambda: self.now[0]),
            unittest.mock.patch.object(wx, "_spawn", lambda fn: None),
            unittest.mock.patch.object(wx, "_nominatim_last", 0.0),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def use(self, fake: Fake):
        p = unittest.mock.patch.object(wx, "_transport", httpx.MockTransport(fake))
        p.start()
        self.addCleanup(p.stop)
        return fake


class RetryTests(Base):
    def test_retries_5xx_then_succeeds_and_logs_each_failure(self):
        seq = iter([503, 502, 200])

        def h(req):
            code = next(seq)
            return httpx.Response(code, json={"ok": True} if code == 200 else {})

        fake = self.use(Fake(api=h))
        with self.assertLogs("pondifarm.weather", "INFO") as cm:
            self.assertEqual(wx._get(wx.FORECAST_URL, {}), {"ok": True})
        self.assertEqual(len(fake.calls), 3)
        self.assertEqual(len(self.sleeps), 2)
        self.assertLess(self.sleeps[0], self.sleeps[1] + 1)  # recuo cresce (com jitter)
        fails = [r for r in cm.records if r.getMessage() == "upstream failure"]
        self.assertEqual([r.attempt for r in fails], [1, 2])
        self.assertEqual([r.status for r in fails], [503, 502])
        self.assertEqual(fails[0].provider, "api")
        self.assertEqual(fails[0].endpoint, "/v1/forecast")
        self.assertTrue(hasattr(fails[0], "duration_ms"))

    def test_gives_up_after_four_attempts(self):
        fake = self.use(Fake(api=httpx.Response(500, json={})))
        with self.assertLogs("pondifarm.weather", "WARNING") as cm:
            with self.assertRaises(wx.UpstreamError) as ctx:
                wx._get(wx.FORECAST_URL, {})
        self.assertEqual(len(fake.calls), wx.MAX_ATTEMPTS)
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("upstream failed", [r.getMessage() for r in cm.records])

    def test_timeouts_and_connect_errors_are_retried(self):
        seq = iter(["timeout", "connect", "ok"])

        def h(req):
            k = next(seq)
            if k == "timeout":
                raise httpx.ReadTimeout("slow", request=req)
            if k == "connect":
                raise httpx.ConnectError("down", request=req)
            return httpx.Response(200, json=[1])

        self.use(Fake(api=h))
        with self.assertLogs("pondifarm.weather", "WARNING") as cm:
            self.assertEqual(wx._get(wx.FORECAST_URL, {}), [1])
        types = [
            r.error_type for r in cm.records if r.getMessage() == "upstream failure"
        ]
        self.assertEqual(types, ["ReadTimeout", "ConnectError"])

    def test_4xx_is_not_retried(self):
        fake = self.use(Fake(api=httpx.Response(400, json={})))
        with self.assertLogs("pondifarm.weather", "WARNING"):
            with self.assertRaises(wx.UpstreamError):
                wx._get(wx.FORECAST_URL, {})
        self.assertEqual(len(fake.calls), 1)

    def test_retry_after_is_respected(self):
        seq = iter([429, 200])

        def h(req):
            c = next(seq)
            return httpx.Response(
                c, json={}, headers={"Retry-After": "3"} if c == 429 else {}
            )

        self.use(Fake(api=h))
        with self.assertLogs("pondifarm.weather", "WARNING"):
            wx._get(wx.FORECAST_URL, {})
        self.assertGreaterEqual(self.sleeps[0], 3)

    def test_retry_after_beyond_budget_gives_up(self):
        fake = self.use(
            Fake(api=httpx.Response(429, json={}, headers={"Retry-After": "120"}))
        )
        with self.assertLogs("pondifarm.weather", "WARNING"):
            with self.assertRaises(wx.UpstreamError):
                wx._get(wx.FORECAST_URL, {})
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(self.sleeps, [])

    def test_nominatim_requests_are_spaced_one_second(self):
        self.use(Fake(nominatim=httpx.Response(200, json=[])))
        wx._get(f"{wx.NOMINATIM_URL}/search", {"q": "a"})
        wx._get(f"{wx.NOMINATIM_URL}/search", {"q": "b"})
        self.assertEqual(len(self.sleeps), 1)
        self.assertAlmostEqual(self.sleeps[0], wx.NOMINATIM_MIN_INTERVAL)


class ForecastTests(Base):
    def test_forecast_air_quality_failure_is_optional(self):
        fake = self.use(
            Fake(
                api=httpx.Response(200, json=_forecast_payload()),
                **{"air-quality-api": httpx.Response(500, json={})},
            )
        )
        with self.assertLogs("pondifarm.weather", "WARNING"):
            d = wx.forecast_for(41.6932, -8.8329, "Viana")
        self.assertFalse(d["stale"])
        self.assertIsNone(d["current"]["uv"])
        self.assertEqual(d["location"], {"lat": 41.69, "lon": -8.83, "label": "Viana"})
        # Coordenadas enviadas já arredondadas.
        api_req = next(r for r in fake.calls if r.url.host.startswith("api."))
        self.assertEqual(api_req.url.params["latitude"], "41.69")

    def test_stale_forecast_is_served_when_upstream_fails(self):
        state = {"down": False}

        def h(req):
            if state["down"]:
                return httpx.Response(503, json={})
            return httpx.Response(200, json=_forecast_payload())

        self.use(Fake(api=h, **{"air-quality-api": httpx.Response(200, json={})}))
        first = wx.forecast_for(41.69, -8.83, None)
        self.assertFalse(first["stale"])
        # Expira o cache e a fonte cai.
        key = ("fc", 41.69, -8.83)
        exp, saved, val = wx._cache[key]
        wx._cache[key] = (0, saved, val)
        state["down"] = True
        with self.assertLogs("pondifarm.weather", "WARNING") as cm:
            second = wx.forecast_for(41.69, -8.83, None)
        self.assertTrue(second["stale"])
        self.assertEqual(second["updatedAt"], first["updatedAt"])
        self.assertIn("serving stale data", [r.getMessage() for r in cm.records])

    def test_no_cache_and_upstream_down_raises(self):
        self.use(Fake(api=httpx.Response(503, json={})))
        with self.assertLogs("pondifarm.weather", "WARNING"):
            with self.assertRaises(httpx.HTTPError):
                wx.forecast_for(41.69, -8.83, None)

    def test_season_is_not_on_the_critical_path(self):
        spawned = []
        with unittest.mock.patch.object(wx, "_spawn", spawned.append):
            fake = self.use(
                Fake(
                    api=httpx.Response(200, json=_forecast_payload()),
                    **{
                        "air-quality-api": httpx.Response(200, json={}),
                        "archive-api": httpx.Response(
                            200,
                            json={
                                "hourly": {
                                    "time": ["2026-07-01T15:00"],
                                    "temperature_2m": [38.0],
                                    "relative_humidity_2m": [30],
                                }
                            },
                        ),
                    },
                )
            )
            d = wx.forecast_for(41.69, -8.83, None)
            self.assertIsNone(d["season"])
            self.assertNotIn("archive-api.open-meteo.com", fake.hosts())
            self.assertEqual(len(spawned), 1)
            # Um segundo pedido enquanto corre não lança outro cálculo.
            wx.forecast_for(41.69, -8.83, None)
            self.assertEqual(len(spawned), 1)
            spawned[0]()  # o cálculo em segundo plano termina
            d = wx.forecast_for(41.69, -8.83, None)
        self.assertEqual(d["season"]["alertDays"], 1)


class PlaceSearchTests(Base):
    def test_postcode_formats_resolve_offline(self):
        fake = self.use(Fake())
        for q in ("4935-585", "4935 585", "4935585", " 4935-585 "):
            res = wx.search_places(q)
            self.assertEqual(res[0]["label"], "Chafé · Viana do Castelo", q)
            self.assertEqual((res[0]["lat"], res[0]["lon"]), (41.63, -8.79))
        self.assertEqual(fake.calls, [])

    def test_four_digit_postcode_lists_the_area(self):
        self.use(Fake())
        res = wx.search_places("4935")
        self.assertEqual(res[0]["label"], "Viana do Castelo")
        self.assertIn("Vila Nova de Anha · Viana do Castelo", [r["label"] for r in res])

    def test_unknown_postcode_area_falls_back_to_nominatim(self):
        fake = self.use(
            Fake(
                nominatim=httpx.Response(
                    200,
                    json=[
                        {
                            "lat": "41.65",
                            "lon": "-8.80",
                            "display_name": "Darque, Viana do Castelo",
                            "address": {
                                "village": "Darque",
                                "state": "Viana do Castelo",
                            },
                        }
                    ],
                )
            )
        )
        with unittest.mock.patch.object(pt_postcodes, "lookup", return_value=[]):
            res = wx.search_places("4935-999")
        self.assertEqual(res[0]["label"], "Darque · Viana do Castelo")
        self.assertEqual(fake.calls[0].url.params["postalcode"], "4935-999")
        self.assertEqual(fake.calls[0].url.params["countrycodes"], "pt")

    def test_name_search_ranks_portugal_first(self):
        self.use(
            Fake(
                **{
                    "geocoding-api": httpx.Response(
                        200,
                        json={
                            "results": [
                                {
                                    "name": "Viana",
                                    "admin1": "Espírito Santo",
                                    "country": "Brazil",
                                    "country_code": "BR",
                                    "latitude": -20.39,
                                    "longitude": -40.49,
                                },
                                {
                                    "name": "Viana do Castelo",
                                    "admin1": "Viana do Castelo",
                                    "country": "Portugal",
                                    "country_code": "PT",
                                    "latitude": 41.69,
                                    "longitude": -8.83,
                                },
                            ]
                        },
                    )
                }
            )
        )
        res = wx.search_places("Viana")
        self.assertEqual(
            res[0]["label"], "Viana do Castelo, Viana do Castelo, Portugal"
        )
        self.assertEqual(res[-1]["label"], "Viana, Espírito Santo, Brazil")

    def test_small_parish_found_offline_when_open_meteo_has_nothing(self):
        fake = self.use(Fake(**{"geocoding-api": httpx.Response(200, json={})}))
        res = wx.search_places("Vila Nova de Anha")
        self.assertEqual(res[0]["label"], "Vila Nova de Anha · Viana do Castelo")
        self.assertNotIn("nominatim.openstreetmap.org", fake.hosts())

    def test_nominatim_name_fallback_only_on_submit(self):
        nom = httpx.Response(
            200,
            json=[
                {
                    "lat": "41.0",
                    "lon": "-8.0",
                    "display_name": "Lugar X",
                    "address": {"hamlet": "Lugar X"},
                }
            ],
        )
        fake = self.use(
            Fake(**{"geocoding-api": httpx.Response(200, json={}), "nominatim": nom})
        )
        self.assertEqual(wx.search_places("Zzqx lugarejo"), [])
        self.assertNotIn("nominatim.openstreetmap.org", fake.hosts())
        res = wx.search_places("Zzqx lugarejo", submit=True)
        self.assertEqual(res[0]["lat"], 41.0)
        self.assertIn("nominatim.openstreetmap.org", fake.hosts())
        self.assertEqual(fake.calls[-1].url.params["countrycodes"], "pt")

    def test_reverse_geocode_failure_returns_none_and_logs(self):
        self.use(Fake(nominatim=httpx.Response(503, json={})))
        with self.assertLogs("pondifarm.weather", "WARNING"):
            self.assertIsNone(wx.place_name(41.69, -8.83))


if __name__ == "__main__":
    unittest.main()

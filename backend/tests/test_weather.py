"""Tempo e bem-estar: THI, avisos e regras das rotas (sem rede: as fontes são simuladas)."""

import os
import unittest
from unittest import mock

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from services import weather_service as wx  # noqa: E402
from tests import test_organization_access as toa  # noqa: E402


def _hours(temps, rh, rain=None, pop=None, gust=None):
    n = len(temps)
    h = {
        "time": [f"2026-06-21T{i:02d}:00" for i in range(n)],
        "temp": temps,
        "rh": rh,
        "rain": rain or [0] * n,
        "pop": pop,
        "gust": gust or [10] * n,
    }
    h["thi"] = [wx.thi(t, r) for t, r in zip(temps, rh)]
    return h


class WeatherRulesTests(unittest.TestCase):
    def test_thi_and_bands(self):
        self.assertAlmostEqual(
            wx.thi(37.7, 25), 82.6, delta=0.1
        )  # 21 Jun 2026, Castelo Branco
        self.assertEqual(wx.thi_band(70), "normal")
        self.assertEqual(wx.thi_band(76), "alert")
        self.assertEqual(wx.thi_band(80), "danger")
        self.assertEqual(wx.thi_band(85), "emergency")

    def test_heat_window_has_coherent_hours(self):
        temps = [20] * 10 + [36] * 6 + [20] * 8
        al = wx.build_alerts(_hours(temps, [30] * 24))
        heat = [a for a in al if a["kind"] == "heat"]
        self.assertEqual(len(heat), 1)
        self.assertEqual((heat[0]["start"], heat[0]["end"]), ("10:00", "16:00"))
        self.assertIn("from 10:00 to 16:00", heat[0]["title"])
        self.assertEqual(heat[0]["severity"], "danger")

    def test_rain_cold_and_wind(self):
        n = 24
        rain = [0] * n
        rain[14] = rain[15] = 3.0
        gust = [10] * n
        gust[20] = 62
        al = wx.build_alerts(
            _hours([3] + [12] * (n - 1), [80] * n, rain=rain, pop=[10] * n, gust=gust)
        )
        kinds = {a["kind"] for a in al}
        self.assertEqual(kinds, {"rain", "cold", "wind"})
        rain_a = next(a for a in al if a["kind"] == "rain")
        self.assertEqual((rain_a["start"], rain_a["end"]), ("14:00", "16:00"))
        self.assertIn("6.0 mm", rain_a["text"])

    def test_calm_day_has_no_alerts_and_ids_are_stable(self):
        h = _hours([15] * 24, [60] * 24)
        self.assertEqual(wx.build_alerts(h), [])
        h2 = _hours([20] * 10 + [36] * 6 + [20] * 8, [30] * 24)
        self.assertEqual(wx.build_alerts(h2)[0]["id"], wx.build_alerts(h2)[0]["id"])

    def test_icon_kind(self):
        self.assertEqual(wx.weather_kind(95, 0, None, 60, 10, True), "storm")
        self.assertEqual(wx.weather_kind(61, 1.2, 80, 60, 10, True), "rain")
        self.assertEqual(wx.weather_kind(0, 0, 0, 82, 10, True), "hot")
        self.assertEqual(wx.weather_kind(0, 0, 0, 60, 55, True), "wind")
        self.assertEqual(wx.weather_kind(0, 0, 0, 60, 10, False), "night")
        self.assertEqual(wx.weather_kind(0, 0, 0, 60, 10, True), "sun")
        self.assertEqual(wx.round_coord(39.8237), 39.82)


class WeatherRouteTests(toa.OrganizationAccessTests):
    """Reaproveita as ajudas (registo, Líder, membro); só correm os testes daqui."""

    def test_location_is_leader_only_rounded_and_drives_the_forecast(self):
        leader, org = self.leader_and_org()
        member = self.member(leader, org)
        url = f"/api/v1/organizations/{org}/weather"
        self.assertIsNone(
            self.client.get(url, headers=self.h(member)).json()["location"]
        )
        loc = {"lat": 39.82374, "lon": -7.49121, "label": "Castelo Branco"}
        r = self.client.put(
            f"/api/v1/organizations/{org}/farm-location",
            json=loc,
            headers=self.h(member),
        )
        self.assertEqual(r.status_code, 403)
        r = self.client.put(
            f"/api/v1/organizations/{org}/farm-location",
            json=loc,
            headers=self.h(leader),
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((r.json()["lat"], r.json()["lon"]), (39.82, -7.49))
        fake = {
            "location": {"lat": 39.82, "lon": -7.49, "label": "Castelo Branco"},
            "alerts": [],
        }
        with mock.patch.object(wx, "forecast_for", return_value=dict(fake)) as f:
            got = self.client.get(url, headers=self.h(member))
        self.assertEqual(got.status_code, 200, got.text)
        f.assert_called_once_with(39.82, -7.49, "Castelo Branco", None)
        self.assertFalse(got.json()["canSetLocation"])

    def test_other_org_cannot_read_weather(self):
        leader, org = self.leader_and_org()
        other = self.register("x@x.pt", org="Outra", name="Outro")
        r = self.client.get(
            f"/api/v1/organizations/{org}/weather", headers=self.h(other)
        )
        self.assertEqual(r.status_code, 403)


def load_tests(loader, tests, pattern):
    """Sem isto, herdar a classe voltava a correr todos os testes de organizações."""
    suite = unittest.TestSuite(loader.loadTestsFromTestCase(WeatherRulesTests))
    for name in loader.getTestCaseNames(WeatherRouteTests):
        if name in WeatherRouteTests.__dict__:
            suite.addTest(WeatherRouteTests(name))
    return suite

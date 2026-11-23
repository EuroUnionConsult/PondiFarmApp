"""Tempo em cada scan do animal (ERA5/previsão simulados: sem rede)."""

import os
import unittest
import unittest.mock
import uuid
from datetime import date, datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from models.models import Animal, AnimalScan, Breed, Species  # noqa: E402
from services import weather_service as wx  # noqa: E402
from tests import test_organization_access as toa  # noqa: E402


def _payload(start: date, days: int, temp=20.0, rh=50.0, rain=0.0, hot_days=()):
    t, tc, h, p = [], [], [], []
    for d in range(days):
        day = start + timedelta(days=d)
        for hr in range(24):
            t.append(f"{day.isoformat()}T{hr:02d}:00")
            hot = day in hot_days and 12 <= hr <= 16
            tc.append(36.0 if hot else temp)
            h.append(30.0 if hot else rh)
            p.append(rain)
    return {
        "hourly": {
            "time": t,
            "temperature_2m": tc,
            "relative_humidity_2m": h,
            "precipitation": p,
        }
    }


class ScanWeatherServiceTests(unittest.TestCase):
    def setUp(self):
        wx._cache.clear()

    def test_one_archive_request_for_all_scans(self):
        today = date(2026, 11, 23)
        s1 = datetime(2026, 9, 1, 10)
        s2 = datetime(2026, 9, 11, 10)
        s3 = datetime(2026, 10, 1, 14)
        hot = {date(2026, 9, 3), date(2026, 9, 4)}
        data = _payload(date(2026, 8, 31), 32, rain=0.5, hot_days=hot)
        with unittest.mock.patch.object(wx, "_get", return_value=data) as g:
            out = wx.scan_weather(
                39.8237, -7.4912, [("c", s3), ("a", s1), ("b", s2)], today
            )
        self.assertEqual(g.call_count, 1)
        url, params = g.call_args[0]
        self.assertEqual(url, wx.ARCHIVE_URL)
        self.assertEqual((params["latitude"], params["longitude"]), (39.82, -7.49))
        self.assertEqual(params["start_date"], "2026-08-31")
        self.assertEqual(params["end_date"], "2026-10-01")
        self.assertEqual([s["scanId"] for s in out["scans"]], ["a", "b", "c"])
        a = out["scans"][0]
        self.assertEqual(a["tempC"], 20.0)
        self.assertEqual(a["band"], "normal")
        self.assertFalse(a["heatStress"])
        self.assertEqual(a["rain24hMm"], 12.0)  # 24 h × 0,5 mm
        first = out["intervals"][0]
        self.assertEqual((first["fromScanId"], first["toScanId"]), ("a", "b"))
        self.assertEqual(first["days"], 10)
        self.assertEqual(first["heatDays"], 2)
        self.assertEqual(out["intervals"][1]["heatDays"], 0)
        self.assertEqual(out["intervals"][1]["avgMaxTempC"], 20.0)

    def test_recent_scans_use_forecast_past_days(self):
        today = date(2026, 11, 23)
        s1 = datetime(2026, 11, 1, 9)
        s2 = datetime(2026, 11, 22, 9)
        calls = []

        def fake(url, params):
            calls.append((url, params))
            if url == wx.ARCHIVE_URL:
                return _payload(date(2026, 10, 31), 18)
            return _payload(date(2026, 11, 18), 6, temp=30.0, rh=60.0)

        with unittest.mock.patch.object(wx, "_get", side_effect=fake):
            out = wx.scan_weather(39.82, -7.49, [("a", s1), ("b", s2)], today)
        self.assertEqual([c[0] for c in calls], [wx.ARCHIVE_URL, wx.FORECAST_URL])
        self.assertEqual(calls[0][1]["end_date"], "2026-11-17")
        self.assertEqual(calls[1][1]["past_days"], 6)
        self.assertEqual(out["scans"][1]["tempC"], 30.0)
        self.assertEqual(out["scans"][0]["tempC"], 20.0)

    def test_missing_hours_are_null_not_invented(self):
        with unittest.mock.patch.object(wx, "_get", return_value={"hourly": {}}):
            out = wx.scan_weather(
                39.82, -7.49, [("a", datetime(2026, 9, 1, 10))], date(2026, 11, 23)
            )
        s = out["scans"][0]
        self.assertIsNone(s["tempC"])
        self.assertIsNone(s["thi"])
        self.assertIsNone(s["rain24hMm"])
        self.assertFalse(s["heatStress"])

    def test_no_scans_no_request(self):
        with unittest.mock.patch.object(wx, "_get") as g:
            self.assertEqual(wx.scan_weather(1, 2, [])["scans"], [])
        g.assert_not_called()


class ScanWeatherRouteTests(toa.OrganizationAccessTests):
    def _animal(self, org_id):
        db = self.Session()
        sp = Species(name="Bovine", normalized_name="bovine")
        db.add(sp)
        db.flush()
        br = Breed(species_id=sp.id, name="Limousin", normalized_name="limousin")
        db.add(br)
        db.flush()
        a = Animal(
            organization_id=uuid.UUID(org_id),
            species_id=sp.id,
            breed_id=br.id,
            name="Mimosa",
            sex="female",
        )
        db.add(a)
        db.flush()
        for d in (0, 30):
            db.add(
                AnimalScan(
                    organization_id=uuid.UUID(org_id),
                    animal_id=a.id,
                    scanned_at=datetime(2026, 9, 1, 10) + timedelta(days=d),
                    estimated_weight=500 + d,
                )
            )
        db.commit()
        aid = str(a.id)
        db.close()
        return aid

    def test_scan_again_attaches_to_the_same_animal(self):
        """«Scan again»: o app envia para /animals/{id}/scans do animal da ficha
        (remoteAnimalId). Não cria animal novo; o histórico ganha um scan."""
        leader, org = self.leader_and_org()
        aid = self._animal(org)
        h = self.h(leader)
        animals = f"/api/v1/organizations/{org}/animals?limit=100"
        before = self.client.get(animals, headers=h).json()
        n_before = len(before if isinstance(before, list) else before["items"])
        body = {
            "scanSource": "lidar",
            "scanStatus": "completed",
            "clientScanId": "again-1",
            "scannedAt": "2026-11-20T11:05:00Z",
            "estimatedWeight": 561,
            "chestCircumference": 198,
        }
        r = self.client.post(f"/api/v1/animals/{aid}/scans", json=body, headers=h)
        self.assertEqual(r.status_code, 201, r.text)
        # Repetir o envio (retry do sync) não duplica: clientScanId é idempotente.
        self.client.post(f"/api/v1/animals/{aid}/scans", json=body, headers=h)
        after = self.client.get(animals, headers=h).json()
        n_after = len(after if isinstance(after, list) else after["items"])
        self.assertEqual(n_after, n_before)
        scans = self.client.get(f"/api/v1/animals/{aid}/scans", headers=h).json()
        self.assertEqual(len(scans), 3)  # 2 do seed + 1

    def test_without_farm_location_returns_nulls(self):
        leader, org = self.leader_and_org()
        aid = self._animal(org)
        r = self.client.get(
            f"/api/v1/animals/{aid}/scan-weather", headers=self.h(leader)
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["location"])
        self.assertEqual(r.json()["scans"], [])

    def test_with_location_and_other_org_forbidden(self):
        leader, org = self.leader_and_org()
        aid = self._animal(org)
        self.client.put(
            f"/api/v1/organizations/{org}/farm-location",
            json={"lat": 39.82, "lon": -7.49, "label": "Castelo Branco"},
            headers=self.h(leader),
        )
        fake = {"scans": [{"scanId": "x"}], "intervals": [], "stale": False}
        with unittest.mock.patch.object(
            wx, "scan_weather", return_value=dict(fake)
        ) as f:
            r = self.client.get(
                f"/api/v1/animals/{aid}/scan-weather", headers=self.h(leader)
            )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["location"]["label"], "Castelo Branco")
        lat, lon, scans = f.call_args[0]
        self.assertEqual((lat, lon, len(scans)), (39.82, -7.49, 2))
        other = self.register("x@x.pt", org="Outra", name="Outro")
        r = self.client.get(
            f"/api/v1/animals/{aid}/scan-weather", headers=self.h(other)
        )
        self.assertEqual(r.status_code, 403)


def load_tests(loader, tests, pattern):
    suite = unittest.TestSuite(loader.loadTestsFromTestCase(ScanWeatherServiceTests))
    for name in loader.getTestCaseNames(ScanWeatherRouteTests):
        if name in ScanWeatherRouteTests.__dict__:
            suite.addTest(ScanWeatherRouteTests(name))
    return suite

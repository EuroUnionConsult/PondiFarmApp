"""POST /api/v1/client-errors: relatórios de erro das apps viram logs estruturados."""

import json
import logging
import os
import unittest
import uuid

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from fastapi.testclient import TestClient  # noqa: E402

from api.v1.client_errors import client_errors_routes as ce  # noqa: E402
from core import rate_limit, security  # noqa: E402
from core.observability import KeyValueFormatter, ScrubFilter  # noqa: E402
from main import app  # noqa: E402

URL = "/api/v1/client-errors"


def _report(**kw):
    body = {
        "platform": "web-mobile",
        "appVersion": "0.10.1",
        "screen": "FarmLocation",
        "message": "Place search failed",
        "httpStatus": 503,
        "endpoint": "/api/v1/places/search?q=4935-585",
        "timestamp": "2026-11-23T09:00:00Z",
    }
    body.update(kw)
    return body


class ClientErrorsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        rate_limit.reset()

    def post(self, body, headers=None):
        with self.assertLogs("pondifarm.client", level="WARNING") as cm:
            r = self.client.post(URL, json=body, headers=headers or {})
        return r, cm.records[0]

    def test_anonymous_report_is_logged_without_query_string(self):
        r, rec = self.post(_report())
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(rec.platform, "web-mobile")
        self.assertEqual(rec.appVersion, "0.10.1")
        self.assertEqual(rec.screen, "FarmLocation")
        self.assertEqual(rec.httpStatus, 503)
        self.assertEqual(rec.endpoint, "/api/v1/places/search")
        self.assertIsNone(rec.userId)

    def test_token_records_user_and_org_ids_never_email(self):
        uid, oid = uuid.uuid4(), uuid.uuid4()
        tok = security.create_access_token(uid, oid)
        r, rec = self.post(_report(), {"Authorization": f"Bearer {tok}"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual((rec.userId, rec.orgId), (str(uid), str(oid)))

    def test_invalid_token_is_still_accepted(self):
        r, rec = self.post(_report(), {"Authorization": "Bearer nope"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(rec.userId, "invalid-token")

    def test_validation(self):
        for bad in (
            _report(platform="android-tv"),
            _report(message=""),
            _report(message="x" * 1001),
            _report(httpStatus=999),
            {"platform": "ios"},
        ):
            r = self.client.post(URL, json=bad)
            self.assertEqual(r.status_code, 422, bad)

    def test_body_size_is_capped(self):
        raw = json.dumps(_report(screen="a" * 9000))
        r = self.client.post(
            URL, content=raw, headers={"Content-Type": "application/json"}
        )
        self.assertEqual(r.status_code, 413)

    def test_rate_limited_per_ip(self):
        logging.getLogger("pondifarm.client").disabled = True
        try:
            for _ in range(ce.RATE_LIMIT):
                self.assertEqual(self.client.post(URL, json=_report()).status_code, 204)
            r = self.client.post(URL, json=_report())
        finally:
            logging.getLogger("pondifarm.client").disabled = False
        self.assertEqual(r.status_code, 429)
        self.assertIn("Retry-After", r.headers)

    def test_scrub_filter_masks_emails_and_tokens(self):
        rec = logging.LogRecord(
            "pondifarm.client", logging.WARNING, "", 0, "x", None, None
        )
        rec.clientMessage = "fail for ana@quinta.pt with eyJhbGciOi.eyJzdWIi.c2ln"
        rec.empty = None
        ScrubFilter().filter(rec)
        self.assertEqual(rec.clientMessage, "fail for [email] with [jwt]")
        self.assertFalse(hasattr(rec, "empty"))
        self.assertIn("clientMessage=fail for [email]", KeyValueFormatter().format(rec))


if __name__ == "__main__":
    unittest.main()

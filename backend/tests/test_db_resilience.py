"""Base serverless a acordar (40613): repetição da ligação, 503 com CORS e arranque."""

import os
import sqlite3
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import OperationalError, ProgrammingError  # noqa: E402

from core import db_resilience as dbr  # noqa: E402

ORIGIN = "https://pondifarm.example"

# Mensagens com o formato real do pyodbc (SQLSTATE + texto + código entre parênteses).
WAKING_MSG = (
    "[42000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Database "
    "'pondifarm' on server 'x.database.windows.net' is not currently available. "
    "Please retry the connection later. (40613) (SQLDriverConnect)"
)


def waking_driver_error():
    return sqlite3.OperationalError(WAKING_MSG)


def waking_dbapi_error():
    return OperationalError("SELECT 1", {}, waking_driver_error())


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def clock(self):
        return self.now

    def sleep(self, s):
        self.sleeps.append(s)
        self.now += s


class TransientClassificationTests(unittest.TestCase):
    def test_waking_and_network_errors_are_transient(self):
        self.assertTrue(dbr.is_transient_db_error(waking_dbapi_error()))
        self.assertTrue(dbr.is_transient_db_error(waking_driver_error()))
        for code in (
            40197,
            40501,
            49918,
            49919,
            49920,
            10928,
            10929,
            233,
            10053,
            10054,
            10060,
        ):
            self.assertTrue(
                dbr.is_transient_db_error(
                    sqlite3.OperationalError(f"[42000] x ({code})")
                ),
                code,
            )
        # pyodbc põe o SQLSTATE no 1.º argumento.
        for state in ("HYT00", "08S01", "08001"):
            self.assertTrue(
                dbr.is_transient_db_error(sqlite3.OperationalError(state, "msg")), state
            )
        self.assertTrue(dbr.is_transient_db_error(dbr.DatabaseWakingError()))

    def test_other_errors_are_not_transient(self):
        self.assertFalse(dbr.is_transient_db_error(ValueError("boom")))
        # Login falhado (18456) e erro de SQL não passam sozinhos.
        self.assertFalse(
            dbr.is_transient_db_error(
                sqlite3.OperationalError("[28000] Login failed (18456)")
            )
        )
        self.assertFalse(
            dbr.is_transient_db_error(
                ProgrammingError(
                    "SELECT 1", {}, sqlite3.ProgrammingError("syntax error")
                )
            )
        )

    def test_numbers_in_sql_parameters_are_ignored(self):
        # O texto do erro do SQLAlchemy traz os parâmetros: (40613) aí não conta.
        exc = OperationalError(
            "SELECT * FROM animals WHERE x = ?",
            ("(40613)",),
            sqlite3.OperationalError("disk I/O error"),
        )
        self.assertFalse(dbr.is_transient_db_error(exc))


class ConnectRetryTests(unittest.TestCase):
    def test_retries_waking_database_then_succeeds(self):
        fc = FakeClock()
        calls = []

        def connect():
            calls.append(1)
            if len(calls) < 3:
                raise waking_driver_error()
            return "conn"

        self.assertEqual(
            dbr.connect_with_retry(connect, sleep=fc.sleep, clock=fc.clock), "conn"
        )
        self.assertEqual(len(calls), 3)
        self.assertEqual(fc.sleeps, [1.0, 2.0])
        self.assertFalse(dbr._wake_lock.locked())

    def test_gives_up_after_budget(self):
        fc = FakeClock()

        def connect():
            fc.now += 15  # cada login falhado demora ~15 s
            raise waking_driver_error()

        with self.assertRaises(sqlite3.OperationalError):
            dbr.connect_with_retry(connect, budget_s=45, sleep=fc.sleep, clock=fc.clock)
        self.assertLessEqual(fc.now, 45 + 15 + 8)
        self.assertFalse(dbr._wake_lock.locked())

    def test_non_transient_error_is_not_retried(self):
        calls = []

        def connect():
            calls.append(1)
            raise sqlite3.OperationalError("[28000] Login failed (18456)")

        with self.assertRaises(sqlite3.OperationalError):
            dbr.connect_with_retry(connect, sleep=lambda s: None)
        self.assertEqual(len(calls), 1)

    def test_other_threads_fail_fast_while_one_waits(self):
        calls = []
        self.assertTrue(dbr._wake_lock.acquire(blocking=False))
        try:
            with self.assertRaises(dbr.DatabaseWakingError):
                dbr.connect_with_retry(lambda: calls.append(1))
        finally:
            dbr._wake_lock.release()
        self.assertEqual(calls, [])

    def test_engine_new_connections_go_through_the_retry(self):
        engine = create_engine("sqlite://", future=True)
        dbr.install_connect_retry(engine)
        real_connect = engine.dialect.connect
        fails = {"n": 2}

        def flaky_connect(*a, **kw):
            if fails["n"]:
                fails["n"] -= 1
                raise waking_driver_error()
            return real_connect(*a, **kw)

        with (
            patch.object(engine.dialect, "connect", side_effect=flaky_connect),
            patch.object(dbr.time, "sleep") as sleep,
        ):
            with engine.connect() as conn:
                self.assertEqual(conn.execute(text("SELECT 1")).scalar(), 1)
        self.assertEqual(fails["n"], 0)
        self.assertEqual(sleep.call_count, 2)


class StartupRetryTests(unittest.TestCase):
    def test_startup_waits_for_waking_database(self):
        fc = FakeClock()
        calls = []

        def init():
            calls.append(1)
            if len(calls) < 4:
                raise waking_dbapi_error()

        dbr.initialize_database_with_retry(init, sleep=fc.sleep, clock=fc.clock)
        self.assertEqual(len(calls), 4)
        self.assertEqual(fc.sleeps, [2.0, 4.0, 8.0])

    def test_startup_gives_up_within_app_service_limit(self):
        fc = FakeClock()

        def init():
            fc.now += 60  # pior caso de uma tentativa (45 s de repetições + 1 login)
            raise waking_dbapi_error()

        with self.assertRaises(OperationalError):
            dbr.initialize_database_with_retry(init, sleep=fc.sleep, clock=fc.clock)
        self.assertLess(fc.now, 230)

    def test_startup_non_transient_error_exits_immediately(self):
        calls = []

        def init():
            calls.append(1)
            raise RuntimeError("Database configuration is missing")

        with self.assertRaises(RuntimeError):
            dbr.initialize_database_with_retry(init, sleep=lambda s: None)
        self.assertEqual(len(calls), 1)

    def test_app_startup_event_uses_retry(self):
        import main

        calls = []

        def init():
            calls.append(1)
            if len(calls) == 1:
                raise waking_dbapi_error()

        with (
            patch("core.database.initialize_database", side_effect=init),
            patch.object(dbr.time, "sleep"),
        ):
            with TestClient(main.create_app()):
                pass
        self.assertEqual(len(calls), 2)


class WakingResponseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import main

        old = os.environ.get("CORS_ORIGINS")
        os.environ["CORS_ORIGINS"] = ORIGIN
        try:
            app = main.create_app()
        finally:
            if old is None:
                os.environ.pop("CORS_ORIGINS", None)
            else:
                os.environ["CORS_ORIGINS"] = old

        @app.get("/api/v1/_test/waking")
        def waking():
            raise waking_dbapi_error()

        @app.get("/api/v1/_test/busy")
        def busy():
            raise dbr.DatabaseWakingError("database is waking up")

        @app.get("/api/v1/_test/boom")
        def boom():
            raise ValueError("boom")

        cls.client = TestClient(app, raise_server_exceptions=False)

    def test_waking_database_is_503_with_retry_after_and_cors(self):
        r = self.client.get("/api/v1/_test/waking", headers={"Origin": ORIGIN})
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"detail": "database_waking"})
        self.assertEqual(r.headers["retry-after"], "10")
        self.assertEqual(r.headers["access-control-allow-origin"], ORIGIN)
        self.assertIn("retry-after", r.headers["access-control-expose-headers"].lower())
        self.assertEqual(r.headers["cache-control"], "no-store")

    def test_busy_waking_lock_is_503(self):
        r = self.client.get("/api/v1/_test/busy", headers={"Origin": ORIGIN})
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.headers["access-control-allow-origin"], ORIGIN)

    def test_other_500_also_carries_cors(self):
        with self.assertLogs("pondifarm.errors", level="ERROR"):
            r = self.client.get("/api/v1/_test/boom", headers={"Origin": ORIGIN})
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.json(), {"detail": "Internal Server Error"})
        self.assertEqual(r.headers["access-control-allow-origin"], ORIGIN)
        self.assertNotIn("boom", r.text)

    def test_unknown_origin_gets_no_cors(self):
        r = self.client.get(
            "/api/v1/_test/waking", headers={"Origin": "https://evil.example"}
        )
        self.assertEqual(r.status_code, 503)
        self.assertNotIn("access-control-allow-origin", r.headers)

    def test_health_db_when_waking_is_503(self):
        from core.database import get_db

        class WakingSession:
            def execute(self, *a, **kw):
                raise waking_dbapi_error()

        self.client.app.dependency_overrides[get_db] = lambda: WakingSession()
        try:
            r = self.client.get("/health/db", headers={"Origin": ORIGIN})
        finally:
            self.client.app.dependency_overrides.clear()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.headers["access-control-allow-origin"], ORIGIN)


if __name__ == "__main__":
    unittest.main()

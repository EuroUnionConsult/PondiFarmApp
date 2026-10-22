"""Endurecimento da API: limite de tentativas no login e no registo, security
headers e documentação interativa desligada por defeito."""

import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from core import rate_limit  # noqa: E402
from core.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402

PW = "senha-forte-123"


class SecurityHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, future=True)

        def override_get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()

    def setUp(self):
        rate_limit.reset()
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def register(self, email, ip="10.0.0.1"):
        return self.client.post(
            "/api/v1/auth/register",
            json={"name": "Pessoa", "email": email, "password": PW},
            headers={"X-Forwarded-For": ip},
        )

    def login(self, email, password, ip="10.0.0.1"):
        return self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            headers={"X-Forwarded-For": ip},
        )

    def test_login_blocks_after_ten_wrong_passwords_for_the_same_account(self):
        self.assertEqual(self.register("a@x.pt").status_code, 201)
        for i in range(10):
            # IPs diferentes: o limite por conta não depende do IP.
            self.assertEqual(self.login("a@x.pt", "errada", ip=f"10.1.0.{i}").status_code, 401)
        r = self.login("a@x.pt", PW, ip="10.2.0.1")
        self.assertEqual(r.status_code, 429)
        self.assertIn("Retry-After", r.headers)

    def test_successful_login_resets_the_account_counter(self):
        self.register("b@x.pt")
        for _ in range(9):
            self.login("b@x.pt", "errada")
        self.assertEqual(self.login("b@x.pt", PW).status_code, 200)
        for _ in range(9):
            self.assertEqual(self.login("b@x.pt", "errada").status_code, 401)

    def test_login_blocks_one_ip_trying_many_accounts(self):
        for i in range(30):
            self.assertEqual(self.login(f"n{i}@x.pt", "errada", ip="10.9.9.9").status_code, 401)
        self.assertEqual(self.login("outra@x.pt", "errada", ip="10.9.9.9").status_code, 429)
        self.assertEqual(self.login("outra@x.pt", "errada", ip="10.9.9.8").status_code, 401)

    def test_forged_forwarded_for_prefix_does_not_dodge_the_ip_limit(self):
        # O Azure acrescenta o IP real no fim; o que o cliente põe à esquerda é ignorado.
        for i in range(30):
            self.login(f"m{i}@x.pt", "errada", ip=f"1.1.1.{i}, 10.7.7.7")
        self.assertEqual(self.login("z@x.pt", "errada", ip="9.9.9.9, 10.7.7.7").status_code, 429)

    def test_register_is_limited_per_ip(self):
        for i in range(10):
            self.assertEqual(self.register(f"r{i}@x.pt", ip="10.3.3.3").status_code, 201)
        self.assertEqual(self.register("r10@x.pt", ip="10.3.3.3").status_code, 429)
        self.assertEqual(self.register("r10@x.pt", ip="10.3.3.4").status_code, 201)

    def test_login_rejects_huge_password_before_hashing(self):
        # O handler da app devolve 400 para erros de validação.
        self.assertEqual(self.login("c@x.pt", "x" * 10_000).status_code, 400)

    def test_security_headers_on_api_responses(self):
        r = self.client.get("/health")
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(r.headers["X-Frame-Options"], "DENY")
        self.assertIn("max-age=", r.headers["Strict-Transport-Security"])
        self.assertIn("default-src 'none'", r.headers["Content-Security-Policy"])
        r = self.client.get("/api/v1/auth/me")
        self.assertEqual(r.headers["Cache-Control"], "no-store")

    def test_interactive_docs_are_off_by_default(self):
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 404, path)


if __name__ == "__main__":
    unittest.main()

"""Compressão gzip das respostas da API (GZipMiddleware em main.py)."""

import gzip
import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from core import rate_limit  # noqa: E402
from core.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
from models import models  # noqa: E402,F401

PW = "senha-forte-123"
N_VERTICES = 2000
PLY = (
    b"ply\nformat ascii 1.0\n"
    + f"element vertex {N_VERTICES}\n".encode()
    + b"property float x\nproperty float y\nproperty float z\nend_header\n"
    + b"".join(f"{i * 0.001:.4f} 0.5000 1.2500\n".encode() for i in range(N_VERTICES))
)


class CompressionTests(unittest.TestCase):
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

    def herd(self, n=40):
        r = self.client.post(
            "/api/v1/auth/register",
            json={
                "name": "Pessoa",
                "email": "gz@x.pt",
                "password": PW,
                "organizationName": "Quinta GZ",
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        h = {"Authorization": f"Bearer {r.json()['accessToken']}"}
        org = self.client.get("/api/v1/auth/me", headers=h).json()["organizationId"]
        sp = self.client.post(
            "/api/v1/species", json={"name": "Bovine"}, headers=h
        ).json()["id"]
        br = self.client.post(
            f"/api/v1/species/{sp}/breeds", json={"name": "Limousine"}, headers=h
        ).json()["id"]
        first = None
        for i in range(n):
            a = self.client.post(
                "/api/v1/animals",
                json={
                    "organizationId": org,
                    "speciesId": sp,
                    "breedId": br,
                    "name": f"Malhada {i:03d}",
                    "sex": "female",
                },
                headers=h,
            )
            self.assertEqual(a.status_code, 201, a.text)
            first = first or a.json()["id"]
        return h, org, first

    def raw_get(self, url, headers):
        """GET sem descompressão automática, para ver os bytes que vão no fio."""
        with self.client.stream("GET", url, headers=headers) as r:
            return r, b"".join(r.iter_raw())

    def test_large_json_is_gzipped_and_still_parses(self):
        h, org, _ = self.herd()
        url = f"/api/v1/organizations/{org}/animals?limit=100"
        r, wire = self.raw_get(url, {**h, "Accept-Encoding": "gzip"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers.get("content-encoding"), "gzip")
        self.assertIn("accept-encoding", r.headers.get("vary", "").lower())
        body = gzip.decompress(wire)
        self.assertGreater(len(body), 1024)
        self.assertLess(len(wire), len(body) / 3)
        # O que o fetch das apps faz: descomprime e lê o JSON.
        parsed = self.client.get(url, headers=h).json()
        self.assertEqual(len(parsed), 40)
        # Os cabeçalhos de segurança continuam lá.
        self.assertEqual(r.headers.get("cache-control"), "no-store")
        self.assertEqual(r.headers.get("x-content-type-options"), "nosniff")

    def test_client_without_gzip_gets_plain_json(self):
        h, org, _ = self.herd()
        r, wire = self.raw_get(
            f"/api/v1/organizations/{org}/animals?limit=100",
            {**h, "Accept-Encoding": "identity"},
        )
        self.assertIsNone(r.headers.get("content-encoding"))
        self.assertEqual(len(httpx.Response(200, content=wire).json()), 40)

    def test_small_responses_are_not_compressed(self):
        r, _ = self.raw_get("/health", {"Accept-Encoding": "gzip"})
        self.assertIsNone(r.headers.get("content-encoding"))

    def test_mesh_download_is_gzipped_and_bytes_are_identical(self):
        h, org, animal = self.herd(n=1)
        s = self.client.post(
            f"/api/v1/animals/{animal}/scans",
            json={"estimatedWeight": 520, "bodyLength": 160},
            headers=h,
        )
        self.assertEqual(s.status_code, 201, s.text)
        sid = s.json()["id"]
        put = self.client.put(
            f"/api/v1/scans/{sid}/mesh?format=ply",
            content=PLY,
            headers={**h, "Content-Type": "application/octet-stream"},
        )
        self.assertEqual(put.status_code, 204, put.text)
        r, wire = self.raw_get(
            f"/api/v1/scans/{sid}/mesh", {**h, "Accept-Encoding": "gzip"}
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers.get("content-encoding"), "gzip")
        self.assertEqual(r.headers["X-Mesh-Format"], "ply")
        self.assertEqual(gzip.decompress(wire), PLY)
        self.assertLess(len(wire), len(PLY))
        # E o download normal (como o fetch da web e o iPhone) devolve o PLY intacto.
        self.assertEqual(
            self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h).content, PLY
        )


if __name__ == "__main__":
    unittest.main()

"""Modelos 3D dos scans: enviar, ler, validação e isolamento por organização."""

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
from models import models  # noqa: E402

PW = "senha-forte-123"
PLY = b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n"


class ScanMeshTests(unittest.TestCase):
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

    def account(self, email, org):
        r = self.client.post(
            "/api/v1/auth/register",
            json={
                "name": "Pessoa",
                "email": email,
                "password": PW,
                "organizationName": org,
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        h = {"Authorization": f"Bearer {r.json()['accessToken']}"}
        return h, self.client.get("/api/v1/auth/me", headers=h).json()["organizationId"]

    def scan(self, h, org):
        sp = self.client.post(
            "/api/v1/species", json={"name": "Bovine"}, headers=h
        ).json()["id"]
        br = self.client.post(
            f"/api/v1/species/{sp}/breeds", json={"name": "Limousine"}, headers=h
        ).json()["id"]
        a = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": org,
                "speciesId": sp,
                "breedId": br,
                "name": "Malhada",
                "sex": "female",
            },
            headers=h,
        )
        self.assertEqual(a.status_code, 201, a.text)
        s = self.client.post(
            f"/api/v1/animals/{a.json()['id']}/scans",
            json={"estimatedWeight": 520, "bodyLength": 160},
            headers=h,
        )
        self.assertEqual(s.status_code, 201, s.text)
        return s.json()["id"]

    def put(self, h, scan_id, body, fmt="ply"):
        return self.client.put(
            f"/api/v1/scans/{scan_id}/mesh?format={fmt}",
            content=body,
            headers={**h, "Content-Type": "application/octet-stream"},
        )

    def test_upload_then_download_returns_the_same_bytes(self):
        h, org = self.account("a@x.pt", "Quinta A")
        sid = self.scan(h, org)
        self.assertEqual(self.put(h, sid, PLY).status_code, 204)
        r = self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content, PLY)
        self.assertEqual(r.headers["X-Mesh-Format"], "ply")
        self.assertIn("private", r.headers["Cache-Control"])

    def test_has_mesh_flag_on_scans(self):
        h, org = self.account("b@x.pt", "Quinta B")
        sid = self.scan(h, org)
        latest = self.client.get(
            f"/api/v1/organizations/{org}/animals/latest-scans", headers=h
        ).json()
        self.assertFalse(latest[0]["hasMesh"])
        self.put(h, sid, PLY)
        latest = self.client.get(
            f"/api/v1/organizations/{org}/animals/latest-scans", headers=h
        ).json()
        self.assertTrue(latest[0]["hasMesh"])
        self.assertTrue(
            self.client.get(f"/api/v1/scans/{sid}", headers=h).json()["hasMesh"]
        )

    def test_upload_replaces_the_previous_model(self):
        h, org = self.account("c@x.pt", "Quinta C")
        sid = self.scan(h, org)
        self.put(h, sid, PLY)
        newer = PLY + b"1 1 1\n"
        self.assertEqual(self.put(h, sid, newer).status_code, 204)
        self.assertEqual(
            self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h).content, newer
        )

    def test_content_must_match_the_format(self):
        h, org = self.account("d@x.pt", "Quinta D")
        sid = self.scan(h, org)
        self.assertEqual(self.put(h, sid, b"<html>not a mesh</html>").status_code, 422)
        self.assertEqual(self.put(h, sid, PLY, fmt="glb").status_code, 422)
        self.assertEqual(self.put(h, sid, b"", fmt="ply").status_code, 422)
        # Formato fora da lista: erro de validação do parâmetro (a app devolve 400).
        self.assertEqual(self.put(h, sid, PLY, fmt="usdz").status_code, 400)
        self.assertFalse(
            self.client.get(f"/api/v1/scans/{sid}", headers=h).json()["hasMesh"]
        )

    def test_too_large_is_rejected(self):
        h, org = self.account("e@x.pt", "Quinta E")
        sid = self.scan(h, org)
        big = PLY + b"0" * (models.MESH_MAX_BYTES + 1)
        self.assertEqual(self.put(h, sid, big).status_code, 413)

    def test_other_organization_cannot_read_or_write(self):
        h1, org1 = self.account("f@x.pt", "Quinta F")
        h2, _ = self.account("g@x.pt", "Quinta G")
        sid = self.scan(h1, org1)
        self.put(h1, sid, PLY)
        self.assertEqual(
            self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h2).status_code, 403
        )
        self.assertEqual(self.put(h2, sid, PLY).status_code, 403)

    def test_glb_can_be_downloaded_as_ply_for_the_iphone(self):
        import trimesh

        h, org = self.account("i@x.pt", "Quinta I")
        sid = self.scan(h, org)
        glb = trimesh.creation.box(extents=(1, 2, 3)).export(file_type="glb")
        self.assertEqual(self.put(h, sid, glb, fmt="glb").status_code, 204)
        raw = self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h)
        self.assertEqual(raw.headers["X-Mesh-Format"], "glb")
        ply = self.client.get(f"/api/v1/scans/{sid}/mesh?as=ply", headers=h)
        self.assertEqual(ply.status_code, 200)
        self.assertEqual(ply.headers["X-Mesh-Format"], "ply")
        self.assertTrue(ply.content.startswith(b"ply"))
        self.assertIn(b"format ascii", ply.content[:64])
        # PLY guardado passa sem conversão.
        self.put(h, sid, PLY)
        self.assertEqual(
            self.client.get(f"/api/v1/scans/{sid}/mesh?as=ply", headers=h).content, PLY
        )

    def test_conversion_rejects_scenes_with_too_many_instanced_vertices(self):
        import trimesh
        from services import scan_mesh_service

        h, org = self.account("j@x.pt", "Quinta J")
        sid = self.scan(h, org)
        # Uma caixa pequena repetida em muitas instâncias: ficheiro minúsculo, cena enorme.
        box = trimesh.creation.box()
        scene = trimesh.Scene()
        for i in range(200):
            scene.add_geometry(
                box,
                geom_name="box",
                node_name=f"n{i}",
                transform=trimesh.transformations.translation_matrix([i, 0, 0]),
            )
        glb = scene.export(file_type="glb")
        self.assertLess(len(glb), 50_000)
        self.put(h, sid, glb, fmt="glb")
        old = scan_mesh_service.MAX_CONVERT_VERTICES
        scan_mesh_service.MAX_CONVERT_VERTICES = (
            1000  # 200 instâncias x 8 vértices = 1600
        )
        try:
            r = self.client.get(f"/api/v1/scans/{sid}/mesh?as=ply", headers=h)
            self.assertEqual(r.status_code, 413)
        finally:
            scan_mesh_service.MAX_CONVERT_VERTICES = old

    def test_scan_without_model_is_404_and_requires_login(self):
        h, org = self.account("h@x.pt", "Quinta H")
        sid = self.scan(h, org)
        self.assertEqual(
            self.client.get(f"/api/v1/scans/{sid}/mesh", headers=h).status_code, 404
        )
        self.assertEqual(self.client.get(f"/api/v1/scans/{sid}/mesh").status_code, 401)


if __name__ == "__main__":
    unittest.main()

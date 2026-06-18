import unittest
import os
import types
from io import BytesIO
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base, get_db
from main import app
from models.models import Organization, OrganizationMember, User
from prediction.model_registry import FORMULA_BASELINE_METHOD, FORMULA_BASELINE_VERSION
from prediction.schemas import RegisteredWeightModel


class ApiCrudTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def _enable_foreign_keys(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        cls.TestSessionLocal = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )

        def override_get_db():
            db = cls.TestSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=cls.engine)
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def create_organization(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm",
                "documentNumber": "123456789",
                "phone": "+351900000000",
                "email": "contact@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_user(self, email="bruno@example.com"):
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "Bruno Silva",
                "email": email,
                "password": "password-value",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def add_member(self, organization_id, user_id, role=None):
        payload = {"userId": user_id}
        if role is not None:
            payload["role"] = role
        response = self.client.post(
            f"/api/v1/organizations/{organization_id}/members",
            json=payload,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_create_organization(self):
        payload = self.create_organization()
        self.assertEqual(payload["name"], "PondiFarm")
        self.assertEqual(payload["documentNumber"], "123456789")

    def test_create_organization_accepts_formatted_portuguese_nif(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "Formatted PondiFarm",
                "documentNumber": "123 456 789",
                "phone": "+351900000000",
                "email": "formatted@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["documentNumber"], "123456789")

    def test_create_organization_requires_document_number(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm",
                "phone": "+351900000000",
                "email": "contact@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_create_organization_rejects_invalid_portuguese_nif(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "Invalid PondiFarm",
                "documentNumber": "123456780",
                "phone": "+351900000000",
                "email": "invalid@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_list_organizations(self):
        self.create_organization()
        response = self.client.get("/api/v1/organizations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_get_organization_by_id_and_404(self):
        organization = self.create_organization()
        found = self.client.get(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(found.status_code, 200)
        missing = self.client.get(
            "/api/v1/organizations/00000000-0000-0000-0000-000000000999",
        )
        self.assertEqual(missing.status_code, 404)

    def test_update_organization(self):
        organization = self.create_organization()
        response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}",
            json={"phone": "+351911111111"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["phone"], "+351911111111")

    def test_soft_delete_organization_hides_record_and_blocks_updates(self):
        organization = self.create_organization()
        user = self.create_user()
        self.add_member(organization["id"], user["id"])
        response = self.client.delete(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(response.status_code, 204)

        list_response = self.client.get("/api/v1/organizations")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

        get_response = self.client.get(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(get_response.status_code, 404)

        patch_response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}",
            json={"phone": "+351922222222"},
        )
        self.assertEqual(patch_response.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(Organization, organization["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_create_user_hashes_password_and_hides_password_hash(self):
        user = self.create_user()
        self.assertNotIn("passwordHash", user)

        with self.TestSessionLocal() as session:
            stored = session.get(User, user["id"])
            self.assertIsNotNone(stored)
            self.assertNotEqual(stored.password_hash, "password-value")

    def test_duplicate_email_returns_conflict(self):
        self.create_user()
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "Other User",
                "email": "bruno@example.com",
                "password": "other-password",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_duplicate_email_is_case_insensitive(self):
        self.create_user(email="john@email.com")
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "John Duplicate",
                "email": " John@Email.com ",
                "password": "other-password",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_duplicate_organization_document_is_normalized(self):
        self.create_organization()
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm 2",
                "documentNumber": "123 456 789",
                "phone": "+351911111111",
                "email": "other@pondifarm.com",
                "address": "Lisbon, Portugal",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_list_and_update_users_without_password_hash(self):
        user = self.create_user()
        list_response = self.client.get("/api/v1/users")
        self.assertEqual(list_response.status_code, 200)
        self.assertNotIn("passwordHash", list_response.json()[0])

        update_response = self.client.patch(
            f"/api/v1/users/{user['id']}",
            json={"name": "Bruno Updated", "password": "new-password"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["name"], "Bruno Updated")
        self.assertNotIn("passwordHash", update_response.json())

    def test_soft_delete_user_hides_record_and_blocks_updates(self):
        user = self.create_user(email="delete@example.com")
        response = self.client.delete(f"/api/v1/users/{user['id']}")
        self.assertEqual(response.status_code, 204)

        list_response = self.client.get("/api/v1/users")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

        get_response = self.client.get(f"/api/v1/users/{user['id']}")
        self.assertEqual(get_response.status_code, 404)

        patch_response = self.client.patch(
            f"/api/v1/users/{user['id']}",
            json={"name": "Should Fail"},
        )
        self.assertEqual(patch_response.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(User, user["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_list_add_update_soft_delete_members(self):
        organization = self.create_organization()
        user = self.create_user()
        member = self.add_member(organization["id"], user["id"], role=None)

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()[0]["userEmail"], "bruno@example.com")
        self.assertEqual(list_response.json()[0]["role"], "viewer")

        update_response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
            json={"role": "viewer"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["role"], "viewer")

        delete_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
        )
        self.assertEqual(delete_response.status_code, 204)

        list_after_delete = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_after_delete.status_code, 200)
        self.assertEqual(list_after_delete.json(), [])

        patch_after_delete = self.client.patch(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
            json={"role": "viewer"},
        )
        self.assertEqual(patch_after_delete.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(OrganizationMember, member["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_prevent_duplicate_membership(self):
        organization = self.create_organization()
        user = self.create_user()
        self.add_member(organization["id"], user["id"])
        response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "viewer"},
        )
        self.assertEqual(response.status_code, 409)

    def test_reactivate_soft_deleted_membership(self):
        organization = self.create_organization()
        user = self.create_user(email="reactivate@example.com")
        member = self.add_member(organization["id"], user["id"])

        delete_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
        )
        self.assertEqual(delete_response.status_code, 204)

        recreate_response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "viewer"},
        )
        self.assertEqual(recreate_response.status_code, 201)
        self.assertEqual(recreate_response.json()["id"], member["id"])
        self.assertEqual(recreate_response.json()["role"], "viewer")

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

    def test_member_list_ignores_soft_deleted_users(self):
        organization = self.create_organization()
        user = self.create_user(email="member-hidden@example.com")
        self.add_member(organization["id"], user["id"])

        delete_user_response = self.client.delete(f"/api/v1/users/{user['id']}")
        self.assertEqual(delete_user_response.status_code, 204)

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

    def test_reject_invalid_role_and_member_not_found(self):
        organization = self.create_organization()
        user = self.create_user()

        invalid_role_response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "manager"},
        )
        self.assertEqual(invalid_role_response.status_code, 400)

        missing_member_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/00000000-0000-0000-0000-000000000999",
        )
        self.assertEqual(missing_member_response.status_code, 404)

    def test_scan_endpoint_uses_formula_fallback_without_trained_model(self):
        image_buffer = BytesIO()
        Image.new("RGB", (32, 32), color="white").save(image_buffer, format="PNG")
        image_buffer.seek(0)

        fake_detector = types.ModuleType("models.detector")
        fake_geometry = types.ModuleType("utils.geometry")

        def detect_subject(image_array):
            return {
                "bbox": [4, 4, 28, 28],
                "class_name": "cow",
                "confidence": 95.0,
                "is_real_animal": True,
            }

        def bbox_to_measurements(bbox, img_h, img_w, breed):
            return {
                "body_length_cm": 150.0,
                "withers_height_cm": 130.0,
                "thoracic_depth_cm": 68.0,
                "rump_width_cm": 52.0,
                "chest_girth_cm": 190.0,
            }

        fake_detector.detect_subject = detect_subject
        fake_geometry.bbox_to_measurements = bbox_to_measurements
        fallback_model = RegisteredWeightModel(
            model_version=FORMULA_BASELINE_VERSION,
            estimation_method=FORMULA_BASELINE_METHOD,
            is_formula_based=True,
            is_trained_model=False,
            model=None,
            metadata={},
        )

        with patch.dict(
            "sys.modules",
            {
                "models.detector": fake_detector,
                "utils.geometry": fake_geometry,
            },
        ), patch(
            "prediction.model_registry.ModelRegistry.get_active_weight_model",
            return_value=fallback_model,
        ):
            response = self.client.post(
                "/api/v1/scan",
                files={"file": ("cow.png", image_buffer.getvalue(), "image/png")},
                data={"animal_id": "cow-1", "breed": "default"},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()["result"]
        self.assertEqual(result["model_version"], FORMULA_BASELINE_VERSION)
        self.assertEqual(
            result["estimation_method"],
            FORMULA_BASELINE_METHOD,
        )
        self.assertTrue(result["diagnostics"]["is_formula_based"])
        self.assertFalse(result["diagnostics"]["is_trained_model"])

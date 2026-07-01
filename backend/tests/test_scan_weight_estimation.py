import os
import unittest
from unittest.mock import patch
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base, get_db
from main import app
from models.models import AnimalScan


class ScanWeightEstimationTests(unittest.TestCase):
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

    def _create_animal(self):
        organization = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm",
                "documentNumber": "123456789",
                "email": "contact@pondifarm.com",
                "address": "Porto, Portugal",
            },
        ).json()
        species = self.client.post(
            "/api/v1/species",
            json={"name": "Bovine"},
        ).json()
        breed = self.client.post(
            f"/api/v1/species/{species['id']}/breeds",
            json={"name": "Angus"},
        ).json()
        animal = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": organization["id"],
                "speciesId": species["id"],
                "breedId": breed["id"],
                "name": "Animal 001",
                "tagCode": "TAG-001",
                "sex": "female",
                "birthDate": "2024-03-10",
            },
        ).json()
        return animal["id"]

    def create_scan(self, **measurement_overrides):
        animal_id = self._create_animal()
        create_response = self.client.post(
            f"/api/v1/animals/{animal_id}/scans",
            json={},
        )
        self.assertEqual(create_response.status_code, 201)
        scan_id = create_response.json()["id"]

        measurements = {
            "body_length": 152.4,
            "withers_height": 126.8,
            "chest_circumference": 194.3,
            "hip_width": 50.2,
        }
        measurements.update(measurement_overrides)

        with self.TestSessionLocal() as session:
            scan = session.get(AnimalScan, scan_id)
            for column, value in measurements.items():
                setattr(scan, column, value)
            session.commit()
        return scan_id

    def get_scan(self, scan_id):
        with self.TestSessionLocal() as session:
            return session.get(AnimalScan, scan_id)

    def estimate_weight(self, scan_id):
        return self.client.post(f"/api/v1/scans/{scan_id}/estimate-weight")

    def test_missing_scan_returns_404(self):
        response = self.estimate_weight(uuid4())

        self.assertEqual(response.status_code, 404)

    def test_scan_without_chest_circumference_returns_409(self):
        scan_id = self.create_scan(chest_circumference=None)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.get_scan(scan_id).scan_status, "pending_upload")

    def test_scan_without_body_length_returns_409(self):
        scan_id = self.create_scan(body_length=None)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.get_scan(scan_id).scan_status, "pending_upload")

    def test_scan_with_non_positive_measurement_returns_409(self):
        scan_id = self.create_scan(chest_circumference=0)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.get_scan(scan_id).scan_status, "pending_upload")

    def test_valid_scan_returns_200_and_completes(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["scanStatus"], "completed")

    def test_valid_scan_persists_estimated_weight(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        stored = self.get_scan(scan_id)
        self.assertIsNotNone(stored.estimated_weight)
        self.assertGreater(stored.estimated_weight, 0)
        self.assertEqual(response.json()["estimatedWeight"], stored.estimated_weight)

    def test_valid_scan_persists_confidence_and_raw_result(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        stored = self.get_scan(scan_id)
        self.assertIsNotNone(stored.confidence_score)
        self.assertGreaterEqual(stored.confidence_score, 0.0)
        self.assertLessEqual(stored.confidence_score, 0.70)
        self.assertIsNotNone(stored.raw_result_json)
        self.assertIn("estimated_weight_kg", stored.raw_result_json)
        self.assertIn("confidence_score", stored.raw_result_json)
        self.assertIn("model_version", stored.raw_result_json)

    def test_estimation_works_with_only_required_measurements(self):
        scan_id = self.create_scan(withers_height=None, hip_width=None)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["scanStatus"], "completed")
        self.assertGreater(response.json()["estimatedWeight"], 0)

    def test_unexpected_error_marks_scan_failed(self):
        scan_id = self.create_scan()

        class FailingPredictor:
            def predict(self, request):
                raise RuntimeError("predictor unavailable")

        class FailingRegistry:
            def get_default(self):
                return FailingPredictor()

        with patch(
            "services.scan_service.get_model_registry",
            return_value=FailingRegistry(),
        ):
            response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.get_scan(scan_id).scan_status, "failed")

    def test_endpoint_is_present_in_openapi_schema(self):
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            "/api/v1/scans/{scan_id}/estimate-weight",
            response.json()["paths"],
        )


if __name__ == "__main__":
    unittest.main()

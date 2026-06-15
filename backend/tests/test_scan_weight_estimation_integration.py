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


class ScanWeightEstimationIntegrationTests(unittest.TestCase):
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

    def create_scan(self, **overrides):
        values = {
            "body_length_cm": 152.4,
            "withers_height_cm": 126.8,
            "rump_width_cm": 50.2,
            "chest_girth_cm": 194.3,
        }
        values.update(overrides)
        scan = AnimalScan(**values)
        with self.TestSessionLocal() as session:
            session.add(scan)
            session.commit()
            session.refresh(scan)
            return scan.id

    def get_scan(self, scan_id):
        with self.TestSessionLocal() as session:
            return session.get(AnimalScan, scan_id)

    def estimate_weight(self, scan_id):
        return self.client.post(f"/api/v1/scans/{scan_id}/estimate-weight")

    def test_missing_scan_returns_404(self):
        response = self.estimate_weight(uuid4())

        self.assertEqual(response.status_code, 404)

    def test_scan_without_body_length_returns_409(self):
        scan_id = self.create_scan(body_length_cm=None)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.get_scan(scan_id).scan_status, "pending")

    def test_scan_without_chest_girth_returns_409(self):
        scan_id = self.create_scan(chest_girth_cm=None)

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.get_scan(scan_id).scan_status, "pending")

    def test_valid_scan_returns_200(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["scanStatus"], "completed")

    def test_scan_with_only_formula_measurements_returns_200(self):
        scan_id = self.create_scan(
            withers_height_cm=None,
            rump_width_cm=None,
        )

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["scanStatus"], "completed")
        self.assertTrue(
            any(
                "confidence is more conservative" in warning
                for warning in response.json()["diagnostics"]["warnings"]
            ),
        )

    def test_valid_scan_saves_estimated_weight(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        stored = self.get_scan(scan_id)
        self.assertIsNotNone(stored.estimated_weight_kg)
        self.assertGreater(stored.estimated_weight_kg, 0)

    def test_valid_scan_saves_confidence_score(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        stored = self.get_scan(scan_id)
        self.assertIsNotNone(stored.confidence_score)
        self.assertGreaterEqual(stored.confidence_score, 0.0)
        self.assertLessEqual(stored.confidence_score, 0.70)

    def test_valid_scan_saves_estimation_model_version(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.get_scan(scan_id).estimation_model_version,
            "formula-baseline-v0.1.0",
        )

    def test_valid_scan_saves_estimation_method(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.get_scan(scan_id).estimation_method,
            "heart_girth_body_length_formula",
        )

    def test_valid_scan_saves_estimation_diagnostics_json(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        diagnostics = self.get_scan(scan_id).estimation_diagnostics_json
        self.assertIsNotNone(diagnostics)
        self.assertTrue(diagnostics["requires_ground_truth_validation"])
        self.assertTrue(diagnostics["is_formula_based"])
        self.assertFalse(diagnostics["is_trained_model"])

    def test_unexpected_error_marks_scan_status_failed(self):
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

    def test_response_contains_ground_truth_validation_diagnostic(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            response.json()["diagnostics"]["requires_ground_truth_validation"],
        )

    def test_real_weight_fields_are_optional_for_estimation(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        response_json = response.json()
        self.assertIsNone(response_json["realWeightKg"])
        self.assertFalse(response_json["isGroundTruthVerified"])

    def test_estimated_weight_and_real_weight_remain_separate(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        response_json = response.json()
        self.assertIsNotNone(response_json["estimatedWeightKg"])
        self.assertIsNone(response_json["realWeightKg"])
        self.assertFalse(response_json["isGroundTruthVerified"])

    def test_raw_result_json_contains_complete_agent_response(self):
        scan_id = self.create_scan()

        response = self.estimate_weight(scan_id)

        self.assertEqual(response.status_code, 200)
        raw_result = self.get_scan(scan_id).raw_result_json
        self.assertIsNotNone(raw_result)
        self.assertIn("estimated_weight_kg", raw_result)
        self.assertIn("confidence_score", raw_result)
        self.assertIn("model_version", raw_result)
        self.assertIn("estimation_method", raw_result)
        self.assertIn("diagnostics", raw_result)


if __name__ == "__main__":
    unittest.main()

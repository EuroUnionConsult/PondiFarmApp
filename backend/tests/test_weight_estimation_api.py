import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient

from main import app
from prediction.schemas import WeightEstimationResponse


class WeightEstimationApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def build_payload(self, **measurement_overrides):
        measurements = {
            "body_length_cm": 152.4,
            "withers_height_cm": 126.8,
            "thoracic_depth_cm": 65.9,
            "rump_width_cm": 50.2,
            "chest_girth_cm": 194.3,
        }
        measurements.update(measurement_overrides)
        return {
            "species": "cattle",
            "breed": "minhota",
            "sex": "female",
            "age_months": 28,
            "measurements": measurements,
        }

    def test_valid_payload_returns_http_200(self):
        response = self.client.post(
            "/api/v1/predictions/weight-estimation",
            json=self.build_payload(),
        )

        self.assertEqual(response.status_code, 200)
        response_json = response.json()
        parsed_response = WeightEstimationResponse.model_validate(response_json)

        self.assertIn("estimatedWeightKg", response_json)
        self.assertIn("confidenceScore", response_json)
        self.assertGreater(parsed_response.estimated_weight_kg, 0)
        self.assertLessEqual(parsed_response.confidence_score, 0.70)
        self.assertEqual(
            parsed_response.model_version,
            "formula-baseline-v0.1.0",
        )
        self.assertTrue(parsed_response.diagnostics.requires_ground_truth_validation)
        self.assertTrue(parsed_response.diagnostics.is_formula_based)
        self.assertFalse(parsed_response.diagnostics.is_trained_model)

    def test_negative_measurement_returns_http_422(self):
        response = self.client.post(
            "/api/v1/predictions/weight-estimation",
            json=self.build_payload(chest_girth_cm=-194.3),
        )

        self.assertEqual(response.status_code, 422)

    def test_zero_measurement_returns_http_422(self):
        response = self.client.post(
            "/api/v1/predictions/weight-estimation",
            json=self.build_payload(body_length_cm=0),
        )

        self.assertEqual(response.status_code, 422)

    def test_missing_chest_girth_returns_http_422(self):
        payload = self.build_payload()
        payload["measurements"].pop("chest_girth_cm")

        response = self.client.post(
            "/api/v1/predictions/weight-estimation",
            json=payload,
        )

        self.assertEqual(response.status_code, 422)

    def test_missing_body_length_returns_http_422(self):
        payload = self.build_payload()
        payload["measurements"].pop("body_length_cm")

        response = self.client.post(
            "/api/v1/predictions/weight-estimation",
            json=payload,
        )

        self.assertEqual(response.status_code, 422)

    def test_endpoint_is_present_in_openapi_schema(self):
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            "/api/v1/predictions/weight-estimation",
            response.json()["paths"],
        )


if __name__ == "__main__":
    unittest.main()

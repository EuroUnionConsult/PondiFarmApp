import unittest

from pydantic import ValidationError

from prediction.model_registry import DEFAULT_MODEL_VERSION, get_model_registry
from prediction.schemas import WeightEstimationRequest


class WeightEstimationAgentTests(unittest.TestCase):
    def setUp(self):
        self.predictor = get_model_registry().get_default()

    def build_request(self, **measurement_overrides) -> WeightEstimationRequest:
        measurements = {
            "body_length_cm": 150.0,
            "withers_height_cm": 135.0,
            "thoracic_depth_cm": 72.0,
            "rump_width_cm": 52.0,
            "chest_girth_cm": 188.0,
        }
        measurements.update(measurement_overrides)
        return WeightEstimationRequest(
            species="cattle",
            breed="angus",
            sex="female",
            age_months=24,
            measurements=measurements,
        )

    def test_valid_payload_returns_positive_estimated_weight(self):
        response = self.predictor.predict(self.build_request())

        self.assertGreater(response.estimated_weight_kg, 0)
        self.assertEqual(response.model_version, DEFAULT_MODEL_VERSION)
        self.assertEqual(
            response.estimation_method,
            "heart_girth_body_length_formula",
        )

    def test_negative_measurement_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            self.build_request(body_length_cm=-1)

    def test_zero_measurement_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            self.build_request(chest_girth_cm=0)

    def test_out_of_plausible_range_raises_error(self):
        request = self.build_request(chest_girth_cm=340.0)

        with self.assertRaises(ValueError):
            self.predictor.predict(request)

    def test_near_plausible_range_boundary_generates_warning(self):
        response = self.predictor.predict(self.build_request(body_length_cm=82.0))

        self.assertEqual(response.diagnostics.input_quality, "valid_with_warnings")
        self.assertTrue(
            any(
                "range boundary" in warning for warning in response.diagnostics.warnings
            ),
        )

    def test_result_is_deterministic_for_same_input(self):
        request = self.build_request()

        first_response = self.predictor.predict(request)
        second_response = self.predictor.predict(request)

        self.assertEqual(
            first_response.estimated_weight_kg,
            second_response.estimated_weight_kg,
        )
        self.assertEqual(
            first_response.confidence_score,
            second_response.confidence_score,
        )
        self.assertEqual(
            first_response.diagnostics.warnings,
            second_response.diagnostics.warnings,
        )

    def test_confidence_score_stays_between_zero_and_one(self):
        response = self.predictor.predict(self.build_request())

        self.assertGreaterEqual(response.confidence_score, 0.0)
        self.assertLessEqual(response.confidence_score, 1.0)

    def test_confidence_score_does_not_exceed_version_cap(self):
        response = self.predictor.predict(self.build_request())

        self.assertLessEqual(response.confidence_score, 0.70)

    def test_diagnostics_require_ground_truth_validation(self):
        response = self.predictor.predict(self.build_request())

        self.assertTrue(response.diagnostics.requires_ground_truth_validation)

    def test_diagnostics_identify_formula_based_estimation(self):
        response = self.predictor.predict(self.build_request())

        self.assertTrue(response.diagnostics.is_formula_based)
        self.assertFalse(response.diagnostics.is_trained_model)


if __name__ == "__main__":
    unittest.main()

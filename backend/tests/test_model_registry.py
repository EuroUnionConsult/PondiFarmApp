import json
import tempfile
import unittest
from pathlib import Path

import joblib
from sklearn.dummy import DummyRegressor

from prediction.model_registry import (
    EXTERNAL_MODEL_METHOD,
    EXTERNAL_MODEL_VERSION,
    FORMULA_BASELINE_METHOD,
    FORMULA_BASELINE_VERSION,
    ModelRegistry,
)
from prediction.predictor import WeightPredictor


class ModelRegistryTests(unittest.TestCase):
    def test_uses_trained_model_when_file_exists(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            model = DummyRegressor(strategy="constant", constant=450.0)
            model.fit([[150.0, 130.0, 70.0, 50.0, 190.0]], [450.0])
            joblib.dump(model, model_path)
            metadata_path.write_text(
                json.dumps(
                    {
                        "model_version": EXTERNAL_MODEL_VERSION,
                        "feature_names": [
                            "body_length_cm",
                            "withers_height_cm",
                            "thoracic_depth_cm",
                            "rump_width_cm",
                            "chest_girth_cm",
                        ],
                        "metrics": {"mae": 12.0, "rmse": 15.0, "mape": 4.0, "r2": 0.9},
                    },
                ),
                encoding="utf-8",
            )

            registry = ModelRegistry(model_path, metadata_path)
            registered_model = registry.get_active_weight_model()

            self.assertEqual(registered_model.model_version, EXTERNAL_MODEL_VERSION)
            self.assertEqual(registered_model.estimation_method, EXTERNAL_MODEL_METHOD)
            self.assertTrue(registered_model.is_trained_model)
            self.assertFalse(registered_model.is_formula_based)

    def test_uses_formula_baseline_when_trained_model_does_not_exist(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            registry = ModelRegistry(
                Path(temp_dir) / "missing.joblib",
                Path(temp_dir) / "missing.metadata.json",
            )
            registered_model = registry.get_active_weight_model()

            self.assertEqual(registered_model.model_version, FORMULA_BASELINE_VERSION)
            self.assertEqual(
                registered_model.estimation_method, FORMULA_BASELINE_METHOD
            )
            self.assertFalse(registered_model.is_trained_model)
            self.assertTrue(registered_model.is_formula_based)

    def test_prediction_response_identifies_trained_model(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            model = DummyRegressor(strategy="constant", constant=450.0)
            model.fit([[150.0, 130.0, 70.0, 50.0, 190.0]], [450.0])
            joblib.dump(model, model_path)
            metadata_path.write_text(
                json.dumps(
                    {
                        "model_version": EXTERNAL_MODEL_VERSION,
                        "feature_names": [
                            "body_length_cm",
                            "withers_height_cm",
                            "thoracic_depth_cm",
                            "rump_width_cm",
                            "chest_girth_cm",
                        ],
                        "metrics": {"mae": 12.0, "rmse": 15.0, "mape": 4.0, "r2": 0.9},
                    },
                ),
                encoding="utf-8",
            )
            predictor = WeightPredictor(ModelRegistry(model_path, metadata_path))

            prediction = predictor.estimate(
                {
                    "body_length_cm": 150.0,
                    "withers_height_cm": 130.0,
                    "thoracic_depth_cm": 70.0,
                    "rump_width_cm": 50.0,
                    "chest_girth_cm": 190.0,
                },
            )

            self.assertEqual(prediction.model_version, EXTERNAL_MODEL_VERSION)
            self.assertEqual(
                prediction.estimation_method,
                "supervised_regression_external_dataset",
            )
            self.assertFalse(prediction.diagnostics.is_formula_based)
            self.assertTrue(prediction.diagnostics.is_trained_model)
            self.assertTrue(prediction.diagnostics.requires_ground_truth_validation)
            self.assertTrue(prediction.diagnostics.warnings)


if __name__ == "__main__":
    unittest.main()

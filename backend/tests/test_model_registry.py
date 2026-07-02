import json
import tempfile
import unittest
from pathlib import Path

import joblib
from sklearn.dummy import DummyRegressor

from prediction.model_registry import (
    DEFAULT_MODEL_VERSION,
    ModelRegistry,
    get_model_registry,
)
from prediction.predictor import FormulaBasedWeightPredictor
from prediction.schemas import WeightEstimationRequest
from prediction.trained_predictor import (
    TRAINED_MODEL_VERSION,
    TrainedWeightPredictor,
    load_if_available,
)


FEATURE_NAMES = [
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]


def build_request() -> WeightEstimationRequest:
    return WeightEstimationRequest(
        species="cattle",
        breed="angus",
        sex="female",
        age_months=24,
        measurements={
            "body_length_cm": 150.0,
            "withers_height_cm": 130.0,
            "thoracic_depth_cm": 70.0,
            "rump_width_cm": 50.0,
            "chest_girth_cm": 190.0,
        },
    )


def write_dummy_artifact(model_path: Path, metadata_path: Path) -> None:
    model = DummyRegressor(strategy="constant", constant=450.0)
    model.fit([[150.0, 130.0, 70.0, 50.0, 190.0]], [450.0])
    joblib.dump(model, model_path)
    metadata_path.write_text(
        json.dumps(
            {
                "model_version": TRAINED_MODEL_VERSION,
                "feature_names": FEATURE_NAMES,
                "metrics": {"mae": 12.0, "rmse": 15.0, "mape": 4.0, "r2": 0.9},
            },
        ),
        encoding="utf-8",
    )


class ModelRegistryFallbackTests(unittest.TestCase):
    def test_default_is_formula_when_no_trained_artifact(self):
        registry = get_model_registry()
        default_model = registry.get_default()

        self.assertEqual(default_model.model_version, DEFAULT_MODEL_VERSION)
        self.assertIsInstance(default_model, FormulaBasedWeightPredictor)

    def test_load_if_available_returns_none_when_artifact_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            trained = load_if_available(
                model_path=Path(temp_dir) / "missing.joblib",
                metadata_path=Path(temp_dir) / "missing.metadata.json",
            )
            self.assertIsNone(trained)

    def test_registry_only_registers_formula_when_artifact_missing(self):
        # get_model_registry uses the default (empty) models path in tests, so
        # the trained version must not be resolvable.
        registry = get_model_registry()
        with self.assertRaises(KeyError):
            registry.get(TRAINED_MODEL_VERSION)


class TrainedModelLoadingTests(unittest.TestCase):
    def test_load_if_available_returns_predictor_when_artifact_exists(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            write_dummy_artifact(model_path, metadata_path)

            trained = load_if_available(
                model_path=model_path, metadata_path=metadata_path
            )

            self.assertIsInstance(trained, TrainedWeightPredictor)
            self.assertEqual(trained.model_version, TRAINED_MODEL_VERSION)

    def test_trained_predictor_produces_trained_response(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            write_dummy_artifact(model_path, metadata_path)

            trained = load_if_available(
                model_path=model_path, metadata_path=metadata_path
            )
            response = trained.predict(build_request())

            self.assertEqual(response.estimated_weight_kg, 450.0)
            self.assertEqual(response.model_version, TRAINED_MODEL_VERSION)
            self.assertEqual(
                response.estimation_method,
                "supervised_regression_external_dataset",
            )
            self.assertFalse(response.diagnostics.is_formula_based)
            self.assertTrue(response.diagnostics.is_trained_model)
            self.assertTrue(response.diagnostics.requires_ground_truth_validation)
            self.assertTrue(response.diagnostics.warnings)

    def test_registry_registers_trained_model_when_artifact_present(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            write_dummy_artifact(model_path, metadata_path)

            registry = ModelRegistry()
            registry.register(FormulaBasedWeightPredictor())
            trained = load_if_available(
                model_path=model_path, metadata_path=metadata_path
            )
            registry.register(trained)

            # Formula stays the default; trained is retrievable by its version.
            self.assertIsInstance(registry.get_default(), FormulaBasedWeightPredictor)
            self.assertIs(registry.get(TRAINED_MODEL_VERSION), trained)


if __name__ == "__main__":
    unittest.main()

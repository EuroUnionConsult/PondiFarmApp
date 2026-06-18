from typing import Dict, List

from prediction.model_registry import ModelRegistry
from prediction.schemas import (
    PredictionDiagnostics,
    RegisteredWeightModel,
    WeightPredictionResult,
)


DEFAULT_FEATURE_NAMES = [
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]

EXTERNAL_DATASET_WARNING = (
    "This model was trained on an external dataset and has not yet been calibrated "
    "with PondiFarm/BoviScan farm ground-truth data."
)


class WeightPredictor:
    def __init__(self, model_registry: ModelRegistry) -> None:
        self.model_registry = model_registry

    def estimate(self, measurements: Dict[str, float]) -> WeightPredictionResult:
        registered_model = self.model_registry.get_active_weight_model()
        if registered_model.is_trained_model and registered_model.model is not None:
            return self._estimate_with_trained_model(measurements, registered_model)
        return estimate_with_formula_baseline(measurements, registered_model)

    def _estimate_with_trained_model(
        self,
        measurements: Dict[str, float],
        registered_model: RegisteredWeightModel,
    ) -> WeightPredictionResult:
        feature_names = get_feature_names(registered_model)
        feature_row = [
            [float(measurements[feature_name]) for feature_name in feature_names]
        ]
        predicted_weight = float(registered_model.model.predict(feature_row)[0])
        confidence_score = confidence_from_metadata(registered_model.metadata)
        return WeightPredictionResult(
            estimated_weight_kg=round(predicted_weight, 1),
            confidence_score=confidence_score,
            model_version=registered_model.model_version,
            estimation_method=registered_model.estimation_method,
            diagnostics=PredictionDiagnostics(
                is_formula_based=False,
                is_trained_model=True,
                requires_ground_truth_validation=True,
                warnings=[EXTERNAL_DATASET_WARNING],
            ),
        )


def estimate_weight(measurements: Dict[str, float]) -> WeightPredictionResult:
    return WeightPredictor(ModelRegistry()).estimate(measurements)


def estimate_with_formula_baseline(
    measurements: Dict[str, float],
    registered_model: RegisteredWeightModel,
) -> WeightPredictionResult:
    body_length_cm = float(measurements["body_length_cm"])
    chest_girth_cm = float(measurements["chest_girth_cm"])
    estimated_weight = (chest_girth_cm * chest_girth_cm * body_length_cm) / 10840.0
    return WeightPredictionResult(
        estimated_weight_kg=round(estimated_weight, 1),
        confidence_score=0.72,
        model_version=registered_model.model_version,
        estimation_method=registered_model.estimation_method,
        diagnostics=PredictionDiagnostics(
            is_formula_based=True,
            is_trained_model=False,
            requires_ground_truth_validation=False,
            warnings=[],
        ),
    )


def get_feature_names(registered_model: RegisteredWeightModel) -> List[str]:
    metadata_feature_names = registered_model.metadata.get("feature_names")
    if isinstance(metadata_feature_names, list) and metadata_feature_names:
        return [str(feature_name) for feature_name in metadata_feature_names]
    return DEFAULT_FEATURE_NAMES.copy()


def confidence_from_metadata(metadata: Dict[str, object]) -> float:
    metrics = metadata.get("metrics")
    if not isinstance(metrics, dict):
        return 0.75
    raw_mape = metrics.get("mape")
    if not isinstance(raw_mape, (float, int)):
        return 0.75
    confidence = 1.0 - (float(raw_mape) / 100.0)
    return round(clamp(confidence, 0.5, 0.9), 2)


def clamp(value: float, lower_limit: float, upper_limit: float) -> float:
    return max(lower_limit, min(upper_limit, value))

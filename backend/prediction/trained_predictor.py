from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from prediction.measurement_validator import validate_measurements
from prediction.schemas import (
    PredictionDiagnostics,
    WeightEstimationRequest,
    WeightEstimationResponse,
)


TRAINED_MODEL_VERSION = "external-trained-v0.1.0"
TRAINED_ESTIMATION_METHOD = "supervised_regression_external_dataset"

DEFAULT_FEATURE_NAMES = [
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]

EXTERNAL_DATASET_WARNING = (
    "This model was trained on an external dataset and has not yet been "
    "calibrated with PondiFarm farm ground-truth data."
)

DEFAULT_TRAINED_MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "ml"
    / "models"
    / "weight"
    / (TRAINED_MODEL_VERSION + ".joblib")
)
DEFAULT_TRAINED_METADATA_PATH = DEFAULT_TRAINED_MODEL_PATH.with_suffix(
    ".metadata.json",
)


class TrainedWeightPredictor:
    """Runtime adapter for an offline-trained joblib regressor.

    Implements the same ``predict(request) -> WeightEstimationResponse``
    Protocol as :class:`FormulaBasedWeightPredictor`. Instantiation never
    imports scikit-learn at module load and never fails when no artifact is
    present; :func:`load_if_available` returns ``None`` in that case so the
    registry keeps the formula baseline as its default.
    """

    estimation_method = TRAINED_ESTIMATION_METHOD

    def __init__(
        self,
        model: object,
        metadata: dict[str, object],
        model_version: str = TRAINED_MODEL_VERSION,
    ) -> None:
        self._model = model
        self._metadata = metadata
        self.model_version = model_version

    def predict(
        self,
        request: WeightEstimationRequest,
    ) -> WeightEstimationResponse:
        validation_result = validate_measurements(request.measurements)

        feature_names = _feature_names(self._metadata)
        feature_row = [
            [
                float(getattr(request.measurements, feature_name))
                for feature_name in feature_names
            ],
        ]
        predicted_weight = float(self._model.predict(feature_row)[0])

        warnings = list(validation_result.warnings)
        warnings.append(EXTERNAL_DATASET_WARNING)

        diagnostics = PredictionDiagnostics(
            input_quality=validation_result.input_quality,
            warnings=warnings,
            requires_ground_truth_validation=True,
            is_formula_based=False,
            is_trained_model=True,
        )

        return WeightEstimationResponse(
            estimated_weight_kg=round(predicted_weight, 1),
            confidence_score=_confidence_from_metadata(self._metadata),
            model_version=self.model_version,
            estimation_method=self.estimation_method,
            diagnostics=diagnostics,
        )


def load_if_available(
    model_path: Path = DEFAULT_TRAINED_MODEL_PATH,
    metadata_path: Path = DEFAULT_TRAINED_METADATA_PATH,
) -> Optional[TrainedWeightPredictor]:
    """Load the trained model if the joblib artifact exists, else ``None``.

    Safe to call at import time: it only touches the filesystem and only
    imports ``joblib`` when an artifact is actually present.
    """
    model_path = Path(model_path)
    if not model_path.exists():
        return None

    import joblib

    # Security: only loads a locally trained, self-produced artifact from the
    # repo's own ml/models/weight/ directory (never committed, never fetched
    # from an untrusted remote). Do not point this at third-party joblib files.
    model = joblib.load(model_path)
    metadata = _load_metadata(Path(metadata_path))
    model_version = str(metadata.get("model_version", TRAINED_MODEL_VERSION))
    return TrainedWeightPredictor(
        model=model,
        metadata=metadata,
        model_version=model_version,
    )


def _load_metadata(metadata_path: Path) -> dict[str, object]:
    if not metadata_path.exists():
        return {
            "model_version": TRAINED_MODEL_VERSION,
            "feature_names": list(DEFAULT_FEATURE_NAMES),
            "metrics": {},
        }
    with metadata_path.open("r", encoding="utf-8") as metadata_file:
        metadata = json.load(metadata_file)
    if isinstance(metadata, dict):
        return metadata
    return {}


def _feature_names(metadata: dict[str, object]) -> list[str]:
    metadata_feature_names = metadata.get("feature_names")
    if isinstance(metadata_feature_names, list) and metadata_feature_names:
        return [str(feature_name) for feature_name in metadata_feature_names]
    return list(DEFAULT_FEATURE_NAMES)


def _confidence_from_metadata(metadata: dict[str, object]) -> float:
    metrics = metadata.get("metrics")
    if not isinstance(metrics, dict):
        return 0.75
    raw_mape = metrics.get("mape")
    if not isinstance(raw_mape, (float, int)):
        return 0.75
    confidence = 1.0 - (float(raw_mape) / 100.0)
    return round(_clamp(confidence, 0.5, 0.9), 2)


def _clamp(value: float, lower_limit: float, upper_limit: float) -> float:
    return max(lower_limit, min(upper_limit, value))

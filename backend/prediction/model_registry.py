import json
from pathlib import Path
from typing import Dict, Optional

import joblib

from prediction.schemas import RegisteredWeightModel


FORMULA_BASELINE_VERSION = "formula-baseline-v0.1.0"
FORMULA_BASELINE_METHOD = "heart_girth_body_length_formula"
EXTERNAL_MODEL_VERSION = "external-trained-v0.1.0"
EXTERNAL_MODEL_METHOD = "supervised_regression_external_dataset"
DEFAULT_EXTERNAL_MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "ml"
    / "models"
    / "weight"
    / (EXTERNAL_MODEL_VERSION + ".joblib")
)
DEFAULT_EXTERNAL_METADATA_PATH = DEFAULT_EXTERNAL_MODEL_PATH.with_suffix(
    ".metadata.json",
)


class ModelRegistry:
    """Loads the optional supervised model and falls back to the formula baseline."""

    def __init__(
        self,
        external_model_path: Path = DEFAULT_EXTERNAL_MODEL_PATH,
        external_metadata_path: Path = DEFAULT_EXTERNAL_METADATA_PATH,
    ) -> None:
        self.external_model_path = Path(external_model_path)
        self.external_metadata_path = Path(external_metadata_path)
        self._cached_model: Optional[RegisteredWeightModel] = None

    def get_active_weight_model(self) -> RegisteredWeightModel:
        if self.external_model_path.exists():
            return self._load_external_model()
        return self._formula_baseline_model()

    def _load_external_model(self) -> RegisteredWeightModel:
        if self._cached_model is not None:
            return self._cached_model

        model = joblib.load(self.external_model_path)
        metadata = self._load_metadata()
        self._cached_model = RegisteredWeightModel(
            model_version=str(metadata.get("model_version", EXTERNAL_MODEL_VERSION)),
            estimation_method=EXTERNAL_MODEL_METHOD,
            is_formula_based=False,
            is_trained_model=True,
            model=model,
            metadata=metadata,
        )
        return self._cached_model

    def _load_metadata(self) -> Dict[str, object]:
        if not self.external_metadata_path.exists():
            return {
                "model_version": EXTERNAL_MODEL_VERSION,
                "feature_names": [
                    "body_length_cm",
                    "withers_height_cm",
                    "thoracic_depth_cm",
                    "rump_width_cm",
                    "chest_girth_cm",
                ],
                "metrics": {},
            }
        with self.external_metadata_path.open("r", encoding="utf-8") as metadata_file:
            metadata = json.load(metadata_file)
        if isinstance(metadata, dict):
            return metadata
        return {}

    def _formula_baseline_model(self) -> RegisteredWeightModel:
        return RegisteredWeightModel(
            model_version=FORMULA_BASELINE_VERSION,
            estimation_method=FORMULA_BASELINE_METHOD,
            is_formula_based=True,
            is_trained_model=False,
            model=None,
            metadata={},
        )

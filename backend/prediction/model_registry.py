from __future__ import annotations

from typing import Protocol

from prediction.formula_baseline import MODEL_VERSION
from prediction.predictor import FormulaBasedWeightPredictor
from prediction.schemas import WeightEstimationRequest, WeightEstimationResponse


DEFAULT_MODEL_VERSION = MODEL_VERSION


class WeightPredictionModel(Protocol):
    model_version: str

    def predict(
        self,
        request: WeightEstimationRequest,
    ) -> WeightEstimationResponse: ...


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, WeightPredictionModel] = {}

    def register(self, model: WeightPredictionModel) -> None:
        self._models[model.model_version] = model

    def get(self, model_version: str) -> WeightPredictionModel:
        if model_version not in self._models:
            available_versions = ", ".join(sorted(self._models))
            raise KeyError(
                f"Unknown model version '{model_version}'. "
                f"Available versions: {available_versions}",
            )
        return self._models[model_version]

    def get_default(self) -> WeightPredictionModel:
        return self.get(DEFAULT_MODEL_VERSION)


def get_model_registry() -> ModelRegistry:
    registry = ModelRegistry()
    registry.register(FormulaBasedWeightPredictor())
    return registry

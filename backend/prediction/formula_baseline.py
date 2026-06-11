from __future__ import annotations

from dataclasses import dataclass

from prediction.feature_builder import FormulaFeatures


MODEL_VERSION = "formula-baseline-v0.1.0"
ESTIMATION_METHOD = "heart_girth_body_length_formula"
POUNDS_TO_KILOGRAMS = 0.45359237


@dataclass(frozen=True)
class FormulaEstimation:
    estimated_weight_lb: float
    estimated_weight_kg: float


def estimate_weight_from_formula(features: FormulaFeatures) -> FormulaEstimation:
    estimated_weight_lb = (
        (features.heart_girth_in ** 2) * features.body_length_in
    ) / 300
    estimated_weight_kg = estimated_weight_lb * POUNDS_TO_KILOGRAMS

    return FormulaEstimation(
        estimated_weight_lb=estimated_weight_lb,
        estimated_weight_kg=estimated_weight_kg,
    )

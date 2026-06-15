from __future__ import annotations

from dataclasses import dataclass

from prediction.schemas import AnimalMeasurements


CENTIMETERS_PER_INCH = 2.54


@dataclass(frozen=True)
class FormulaFeatures:
    heart_girth_in: float
    body_length_in: float
    chest_girth_to_length_ratio: float
    withers_height_to_depth_ratio: float | None
    rump_width_to_girth_ratio: float | None


def build_formula_features(measurements: AnimalMeasurements) -> FormulaFeatures:
    return FormulaFeatures(
        heart_girth_in=measurements.chest_girth_cm / CENTIMETERS_PER_INCH,
        body_length_in=measurements.body_length_cm / CENTIMETERS_PER_INCH,
        chest_girth_to_length_ratio=(
            measurements.chest_girth_cm / measurements.body_length_cm
        ),
        withers_height_to_depth_ratio=_divide_optional(
            measurements.withers_height_cm,
            measurements.thoracic_depth_cm,
        ),
        rump_width_to_girth_ratio=_divide_optional(
            measurements.rump_width_cm,
            measurements.chest_girth_cm,
        ),
    )


def _divide_optional(
    numerator: float | None, denominator: float | None
) -> float | None:
    if numerator is None or denominator is None:
        return None
    return numerator / denominator

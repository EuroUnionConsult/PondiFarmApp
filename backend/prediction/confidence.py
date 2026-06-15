from __future__ import annotations

from prediction.feature_builder import FormulaFeatures
from prediction.measurement_validator import MeasurementValidationResult


def calculate_confidence_score(
    *,
    validation_result: MeasurementValidationResult,
    features: FormulaFeatures,
) -> float:
    average_boundary_centrality = sum(
        validation_result.boundary_centrality.values(),
    ) / len(validation_result.boundary_centrality)

    ratio_alignment_values = [
        _ratio_alignment(
            value=features.chest_girth_to_length_ratio,
            target=1.28,
            tolerance=0.35,
        ),
    ]
    if features.withers_height_to_depth_ratio is not None:
        ratio_alignment_values.append(
            _ratio_alignment(
                value=features.withers_height_to_depth_ratio,
                target=1.95,
                tolerance=0.55,
            ),
        )
    if features.rump_width_to_girth_ratio is not None:
        ratio_alignment_values.append(
            _ratio_alignment(
                value=features.rump_width_to_girth_ratio,
                target=0.29,
                tolerance=0.12,
            ),
        )

    ratio_alignment = _average(
        ratio_alignment_values,
    )

    warning_penalty = min(0.20, 0.04 * len(validation_result.warnings))
    score = (
        0.55
        + 0.08 * (average_boundary_centrality - 0.5)
        + 0.06 * (ratio_alignment - 0.5)
        - warning_penalty
    )

    bounded_score = max(0.20, min(0.70, score))
    return round(bounded_score, 2)


def _ratio_alignment(*, value: float, target: float, tolerance: float) -> float:
    deviation = abs(value - target)
    if deviation >= tolerance:
        return 0.0
    return 1.0 - (deviation / tolerance)


def _average(values: list[float]) -> float:
    return sum(values) / len(values)

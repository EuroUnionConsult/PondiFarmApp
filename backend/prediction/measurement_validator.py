from __future__ import annotations

from dataclasses import dataclass

from prediction.schemas import AnimalMeasurements


@dataclass(frozen=True)
class PlausibleRange:
    minimum: float
    maximum: float
    warning_margin: float


@dataclass(frozen=True)
class MeasurementValidationResult:
    measurements: AnimalMeasurements
    warnings: list[str]
    input_quality: str
    boundary_centrality: dict[str, float]


PLAUSIBLE_BOVINE_RANGES: dict[str, PlausibleRange] = {
    "body_length_cm": PlausibleRange(minimum=80.0, maximum=260.0, warning_margin=10.0),
    "withers_height_cm": PlausibleRange(
        minimum=80.0,
        maximum=210.0,
        warning_margin=8.0,
    ),
    "thoracic_depth_cm": PlausibleRange(
        minimum=35.0,
        maximum=120.0,
        warning_margin=6.0,
    ),
    "rump_width_cm": PlausibleRange(minimum=20.0, maximum=100.0, warning_margin=5.0),
    "chest_girth_cm": PlausibleRange(
        minimum=90.0,
        maximum=320.0,
        warning_margin=12.0,
    ),
}

OPTIONAL_CONTEXT_MEASUREMENTS = {
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
}


def validate_measurements(
    measurements: AnimalMeasurements,
) -> MeasurementValidationResult:
    warnings: list[str] = []
    boundary_centrality: dict[str, float] = {}

    for field_name, plausible_range in PLAUSIBLE_BOVINE_RANGES.items():
        raw_value = getattr(measurements, field_name)
        if raw_value is None:
            if field_name in OPTIONAL_CONTEXT_MEASUREMENTS:
                warnings.append(
                    f"{field_name} is missing; confidence is more conservative.",
                )
                continue
            raise ValueError(f"{field_name} is required.")

        value = float(raw_value)
        _validate_positive_measurement(field_name=field_name, value=value)
        _validate_plausible_range(
            field_name=field_name,
            value=value,
            plausible_range=plausible_range,
        )
        if _is_near_boundary(value=value, plausible_range=plausible_range):
            warnings.append(
                f"{field_name} is close to the plausible bovine range boundary.",
            )
        boundary_centrality[field_name] = _calculate_boundary_centrality(
            value=value,
            plausible_range=plausible_range,
        )

    warnings.extend(_build_consistency_warnings(measurements))
    input_quality = "valid_with_warnings" if warnings else "valid"

    return MeasurementValidationResult(
        measurements=measurements,
        warnings=warnings,
        input_quality=input_quality,
        boundary_centrality=boundary_centrality,
    )


def _validate_positive_measurement(*, field_name: str, value: float) -> None:
    if value == 0:
        raise ValueError(f"{field_name} must be greater than zero.")
    if value < 0:
        raise ValueError(f"{field_name} must be positive.")


def _validate_plausible_range(
    *,
    field_name: str,
    value: float,
    plausible_range: PlausibleRange,
) -> None:
    if value < plausible_range.minimum or value > plausible_range.maximum:
        raise ValueError(
            f"{field_name}={value} is outside the plausible bovine range "
            f"{plausible_range.minimum}-{plausible_range.maximum} cm.",
        )


def _is_near_boundary(*, value: float, plausible_range: PlausibleRange) -> bool:
    return (
        value - plausible_range.minimum <= plausible_range.warning_margin
        or plausible_range.maximum - value <= plausible_range.warning_margin
    )


def _calculate_boundary_centrality(
    *,
    value: float,
    plausible_range: PlausibleRange,
) -> float:
    half_span = (plausible_range.maximum - plausible_range.minimum) / 2
    midpoint = plausible_range.minimum + half_span
    distance_from_center = abs(value - midpoint)
    normalized_distance = min(distance_from_center / half_span, 1.0)
    return 1.0 - normalized_distance


def _build_consistency_warnings(measurements: AnimalMeasurements) -> list[str]:
    warnings: list[str] = []

    chest_girth_to_length_ratio = (
        measurements.chest_girth_cm / measurements.body_length_cm
    )
    if chest_girth_to_length_ratio < 0.85 or chest_girth_to_length_ratio > 1.70:
        warnings.append(
            "The chest girth to body length ratio "
            "is unusual for bovine body proportions.",
        )

    if (
        measurements.withers_height_cm is not None
        and measurements.thoracic_depth_cm is not None
    ):
        height_to_depth_ratio = (
            measurements.withers_height_cm / measurements.thoracic_depth_cm
        )
        if height_to_depth_ratio < 1.25 or height_to_depth_ratio > 3.20:
            warnings.append(
                "The withers height to thoracic depth ratio looks inconsistent.",
            )

    if measurements.rump_width_cm is not None:
        rump_width_to_girth_ratio = (
            measurements.rump_width_cm / measurements.chest_girth_cm
        )
        if rump_width_to_girth_ratio < 0.15 or rump_width_to_girth_ratio > 0.45:
            warnings.append(
                "The rump width is not well aligned with the reported chest girth.",
            )

    if (
        measurements.thoracic_depth_cm is not None
        and measurements.withers_height_cm is not None
        and measurements.thoracic_depth_cm >= measurements.withers_height_cm
    ):
        warnings.append(
            "Thoracic depth should normally remain below withers height.",
        )

    return warnings

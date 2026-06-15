from __future__ import annotations

from typing import Literal

from pydantic import Field

from schemas.base import APIModel


class AnimalMeasurements(APIModel):
    body_length_cm: float = Field(gt=0)
    chest_girth_cm: float = Field(gt=0)
    withers_height_cm: float | None = Field(default=None, gt=0)
    thoracic_depth_cm: float | None = Field(default=None, gt=0)
    rump_width_cm: float | None = Field(default=None, gt=0)


class WeightEstimationRequest(APIModel):
    species: str = Field(min_length=1)
    breed: str = Field(min_length=1)
    sex: str = Field(min_length=1)
    age_months: int = Field(ge=0)
    measurements: AnimalMeasurements


class PredictionDiagnostics(APIModel):
    input_quality: Literal["valid", "valid_with_warnings"]
    warnings: list[str]
    requires_ground_truth_validation: bool
    is_formula_based: bool
    is_trained_model: bool


class WeightEstimationResponse(APIModel):
    estimated_weight_kg: float
    confidence_score: float
    model_version: str
    estimation_method: str
    diagnostics: PredictionDiagnostics

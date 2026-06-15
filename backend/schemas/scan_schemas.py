from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from schemas.base import APIModel


RealWeightSource = Literal[
    "scale",
    "external_system",
    "producer_reported",
    "unknown",
]


class AnimalScanResponse(APIModel):
    id: UUID
    scan_status: str

    body_length_cm: float | None = None
    withers_height_cm: float | None = None
    thoracic_depth_cm: float | None = None
    rump_width_cm: float | None = None
    chest_girth_cm: float | None = None
    mesh_uri: str | None = None

    estimated_weight_kg: float | None = None
    confidence_score: float | None = None
    estimation_model_version: str | None = None
    estimation_method: str | None = None
    estimation_diagnostics_json: dict[str, object] | None = None
    raw_result_json: dict[str, object] | None = None
    diagnostics: dict[str, object] | None = None

    real_weight_kg: float | None = None
    real_weight_measured_at: datetime | None = None
    real_weight_source: RealWeightSource | None = None
    real_weight_notes: str | None = None
    is_ground_truth_verified: bool = False

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class RealWeightUpdate(APIModel):
    real_weight_kg: float = Field(gt=0)
    real_weight_measured_at: datetime
    real_weight_source: RealWeightSource
    real_weight_notes: str | None = Field(default=None, max_length=1000)
    is_ground_truth_verified: bool = False

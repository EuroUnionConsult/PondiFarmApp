from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from schemas.base import APIModel

ScanStatus = Literal[
    "pending_upload",
    "uploaded",
    "validating",
    "validation_failed",
    "processing",
    "completed",
    "failed",
    "archived",
]
# Alinhado ao CHECK do DB (dbo.animal_scans): {other, manual, photogrammetry, lidar}.
# O scan do app é LiDAR; polycam/imported foram removidos (o DB nunca os aceitou).
ScanSource = Literal["lidar", "manual", "photogrammetry", "other"]


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _ensure_scanned_at_not_future(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is not None:
        current_time = datetime.now(timezone.utc)
        comparable_value = value.astimezone(timezone.utc)
    else:
        current_time = datetime.utcnow()
        comparable_value = value

    # Tolerância de 5 min p/ skew de relógio do device (senão o push logo após a
    # captura vira 422 permanente num iPhone com relógio adiantado).
    if comparable_value > current_time + timedelta(minutes=5):
        raise ValueError("scannedAt cannot be in the future")

    return value


class AnimalScanCreate(APIModel):
    model_config = ConfigDict(extra="forbid")

    scan_source: ScanSource = "lidar"
    # Processamento é feito no device → o scan já nasce concluído por padrão.
    scan_status: ScanStatus = "completed"
    scanned_at: datetime | None = None
    # Medidas morfométricas + peso estimado (vêm prontos do device).
    estimated_weight: float | None = None
    confidence_score: float | None = None
    body_length: float | None = None
    withers_height: float | None = None
    chest_circumference: float | None = None
    hip_width: float | None = None
    raw_result_json: dict[str, Any] | list[Any] | None = None
    client_scan_id: str | None = Field(default=None, max_length=64)  # idempotência (C4)
    notes: str | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)

    @field_validator("scanned_at")
    @classmethod
    def _validate_scanned_at(cls, value: datetime | None) -> datetime | None:
        return _ensure_scanned_at_not_future(value)


class AnimalScanUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    scan_status: ScanStatus | None = None
    scanned_at: datetime | None = None
    notes: str | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)

    @field_validator("scanned_at")
    @classmethod
    def _validate_scanned_at(cls, value: datetime | None) -> datetime | None:
        return _ensure_scanned_at_not_future(value)


class AnimalScanResponse(APIModel):
    id: UUID
    animal_id: UUID
    organization_id: UUID
    scan_status: ScanStatus
    scan_source: ScanSource
    scanned_at: datetime
    estimated_weight: float | None = None
    confidence_score: float | None = None
    body_length: float | None = None
    withers_height: float | None = None
    chest_circumference: float | None = None
    hip_width: float | None = None
    raw_result_json: dict[str, Any] | list[Any] | None = None
    client_scan_id: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


def build_start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min)


def build_end_of_day_exclusive(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), time.min)

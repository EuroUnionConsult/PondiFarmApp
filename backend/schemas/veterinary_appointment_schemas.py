from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from schemas.base import APIModel

AppointmentStatus = Literal[
    "scheduled",
    "completed",
    "cancelled",
    "missed",
    "archived",
]


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _normalize_required_string(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("value must not be blank")
    return cleaned


class VeterinaryAppointmentCreate(APIModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime
    status: AppointmentStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)
    calendar_event_id: str | None = Field(default=None, max_length=255)

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _normalize_required_string(value)

    @field_validator("notes", "calendar_event_id", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)


class VeterinaryAppointmentUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    scheduled_at: datetime | None = None
    status: AppointmentStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)
    calendar_event_id: str | None = Field(default=None, max_length=255)

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_string(value)

    @field_validator("notes", "calendar_event_id", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)


class VeterinaryAppointmentAction(APIModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _validate_notes(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)


class VeterinaryAppointmentResponse(APIModel):
    id: UUID
    organization_id: UUID
    animal_id: UUID
    user_id: UUID | None = None
    title: str
    scheduled_at: datetime
    status: AppointmentStatus
    notes: str | None = None
    calendar_event_id: str | None = None
    created_at: datetime
    updated_at: datetime


def build_start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min)


def build_end_of_day_exclusive(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), time.min)

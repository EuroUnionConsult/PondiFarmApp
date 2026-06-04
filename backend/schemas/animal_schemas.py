from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from schemas.base import APIModel

AnimalSex = Literal["male", "female", "unknown"]


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


class AnimalSpeciesReference(APIModel):
    id: UUID
    name: str


class AnimalBreedReference(APIModel):
    id: UUID
    name: str


class AnimalCreate(APIModel):
    organization_id: UUID
    species_id: UUID
    breed_id: UUID
    name: str = Field(min_length=1)
    tag_code: str | None = None
    sex: AnimalSex
    birth_date: date | None = None
    photo_url: str | None = None
    notes: str | None = None

    @field_validator("tag_code", "photo_url", "notes", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)

    @field_validator("birth_date")
    @classmethod
    def _validate_birth_date(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("birthDate cannot be in the future")
        return value


class AnimalUpdate(APIModel):
    organization_id: UUID | None = None
    species_id: UUID | None = None
    breed_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1)
    tag_code: str | None = None
    sex: AnimalSex | None = None
    birth_date: date | None = None
    photo_url: str | None = None
    notes: str | None = None

    @field_validator("tag_code", "photo_url", "notes", mode="before")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _normalize_optional_string(value)

    @field_validator("birth_date")
    @classmethod
    def _validate_birth_date(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("birthDate cannot be in the future")
        return value


class AnimalResponse(APIModel):
    id: UUID
    organization_id: UUID
    species: AnimalSpeciesReference
    breed: AnimalBreedReference
    name: str
    tag_code: str | None = None
    sex: AnimalSex
    birth_date: date | None = None
    photo_url: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

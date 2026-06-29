from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import Field

from schemas.base import APIModel


class BreedCreate(APIModel):
    name: str = Field(min_length=1)


class BreedUpdate(APIModel):
    species_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1)


class BreedResponse(APIModel):
    id: UUID
    species_id: UUID
    name: str
    created_at: datetime
    updated_at: datetime

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from schemas.base import APIModel


class SpeciesCreate(APIModel):
    name: str = Field(min_length=1)


class SpeciesUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1)


class SpeciesResponse(APIModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime

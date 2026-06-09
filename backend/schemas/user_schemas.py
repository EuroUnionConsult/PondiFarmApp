from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from schemas.base import APIModel


class UserCreate(APIModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=1)


class UserUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=1)


class UserResponse(APIModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
    updated_at: datetime

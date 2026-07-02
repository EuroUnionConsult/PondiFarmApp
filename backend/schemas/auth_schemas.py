from __future__ import annotations

from uuid import UUID

from pydantic import EmailStr, Field

from schemas.base import APIModel


class RegisterRequest(APIModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization_name: str = Field(min_length=1, max_length=255)


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(APIModel):
    id: UUID
    name: str
    email: str
    organization_id: UUID
    organization_name: str

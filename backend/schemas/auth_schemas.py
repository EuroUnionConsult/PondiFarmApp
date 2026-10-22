from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field

from schemas.base import APIModel


class RegisterRequest(APIModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Opcional desde 21/10/2026: sem nome, a conta fica sem organização e escolhe
    # depois (criar uma ou pedir entrada). Com nome — o que a app 0.7.0 e
    # anteriores enviam — cria a organização e a conta fica Líder dela.
    organization_name: str | None = Field(default=None, min_length=1, max_length=255)


class LoginRequest(APIModel):
    email: EmailStr
    # Teto igual ao do registo: uma senha de megabytes faria o hash pesar no servidor.
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(APIModel):
    id: UUID
    name: str
    email: str
    # `active`: membro de uma organização · `pending`: pediu entrada e espera
    # pelo Líder · `none`: ainda não escolheu.
    membership_status: Literal["active", "pending", "none"]
    role: Literal["leader", "member"] | None = None
    # Vazios quando não há organização ativa (as apps antigas leem estes campos).
    organization_id: UUID | None = None
    organization_name: str = ""
    pending_organization_id: UUID | None = None
    pending_organization_name: str | None = None

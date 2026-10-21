from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from schemas.base import APIModel

# Papel como a app o mostra (a BD guarda owner/viewer).
AppRole = Literal["leader", "member"]


class OrganizationCreateRequest(APIModel):
    name: str = Field(min_length=1, max_length=255)


class OrganizationSearchResult(APIModel):
    # Só o nome e o id: quem pesquisa ainda não é membro, não vê mais nada.
    id: UUID
    name: str


class JoinRequestCreate(APIModel):
    organization_id: UUID


class JoinRequestResponse(APIModel):
    id: UUID
    organization_id: UUID
    status: str
    created_at: datetime


class PendingRequestResponse(APIModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    created_at: datetime


class MemberResponse(APIModel):
    user_id: UUID
    name: str
    email: str
    role: AppRole
    since: datetime


class TransferLeadershipRequest(APIModel):
    user_id: UUID

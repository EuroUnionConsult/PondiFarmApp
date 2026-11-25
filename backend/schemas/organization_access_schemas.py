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


class OrganizationEventResponse(APIModel):
    """Um evento do histórico da organização (só o Líder vê)."""

    id: UUID
    type: str
    actor_name: str | None
    subject_name: str | None
    created_at: datetime


# --- Ações em massa (só o Líder) --------------------------------------------

BULK_MAX_IDS = 100


class BulkJoinRequestsBody(APIModel):
    """Aprovar ou recusar vários pedidos de entrada de uma vez."""

    ids: list[UUID] = Field(min_length=1, max_length=BULK_MAX_IDS)
    action: Literal["approve", "deny"]


class BulkRemoveMembersBody(APIModel):
    """Remover várias pessoas da organização de uma vez."""

    user_ids: list[UUID] = Field(min_length=1, max_length=BULK_MAX_IDS)


class BulkItemResult(APIModel):
    id: UUID
    ok: bool
    # Código estável quando falha: already_handled, in_other_organization,
    # not_a_member, is_self, is_leader, error.
    reason: str | None = None


class BulkActionResponse(APIModel):
    succeeded: int
    failed: int
    results: list[BulkItemResult]

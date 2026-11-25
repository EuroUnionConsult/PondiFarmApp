"""Rotas das organizações com Líder (plano de 21/10/2026).

Montado ANTES de `organizations_router` em main.py: `GET /organizations/search`
seria apanhado por `GET /organizations/{organization_id}` e dava 422.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from core import rate_limit
from core.database import get_db
from core.deps import (
    CurrentAccount,
    CurrentUser,
    get_current_account,
    get_current_user,
    require_leader,
)
from models.models import ROLE_LEADER
from schemas.organization_access_schemas import (
    BulkActionResponse,
    BulkItemResult,
    BulkJoinRequestsBody,
    BulkRemoveMembersBody,
    JoinRequestCreate,
    JoinRequestResponse,
    MemberResponse,
    OrganizationCreateRequest,
    OrganizationEventResponse,
    OrganizationSearchResult,
    PendingRequestResponse,
    TransferLeadershipRequest,
)
from services import organization_access_service as svc

organization_access_router = APIRouter(
    prefix="/api/v1/organizations", tags=["organization-access"]
)


def _own_org(current: CurrentUser, organization_id: UUID) -> None:
    if current.organization_id != organization_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização"
        )


# --- Contas sem organização -------------------------------------------------


@organization_access_router.get(
    "/search", response_model=list[OrganizationSearchResult]
)
def search(
    q: str = Query(default=""),
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    return svc.search_organizations(db, q)


@organization_access_router.post(
    "/create",
    response_model=OrganizationSearchResult,
    status_code=status.HTTP_201_CREATED,
)
def create(
    payload: OrganizationCreateRequest,
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    return svc.create_organization(db, account.user, payload.name)


@organization_access_router.post(
    "/join-requests",
    response_model=JoinRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_join(
    payload: JoinRequestCreate,
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    return svc.request_to_join(db, account.user, payload.organization_id)


@organization_access_router.delete(
    "/join-requests/mine", status_code=status.HTTP_204_NO_CONTENT
)
def cancel_my_request(
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    svc.cancel_my_request(db, account.user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Membros ----------------------------------------------------------------


@organization_access_router.get(
    "/{organization_id}/people", response_model=list[MemberResponse]
)
def list_people(
    organization_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _own_org(current, organization_id)
    return [
        MemberResponse(
            user_id=u.id,
            name=u.name,
            email=u.email,
            role="leader" if m.role == ROLE_LEADER else "member",
            since=m.created_at,
        )
        for m, u in svc.list_members(db, organization_id)
    ]


@organization_access_router.post(
    "/{organization_id}/leave", status_code=status.HTTP_204_NO_CONTENT
)
def leave(
    organization_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _own_org(current, organization_id)
    svc.leave_organization(db, current.user, organization_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Só o Líder -------------------------------------------------------------


@organization_access_router.get(
    "/{organization_id}/join-requests", response_model=list[PendingRequestResponse]
)
def list_requests(
    organization_id: UUID,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    _own_org(leader, organization_id)
    return [
        PendingRequestResponse(
            id=r.id,
            user_id=u.id,
            user_name=u.name,
            user_email=u.email,
            created_at=r.created_at,
        )
        for r, u in svc.list_pending_requests(db, organization_id)
    ]


@organization_access_router.post(
    "/{organization_id}/join-requests/{request_id}/approve",
    response_model=JoinRequestResponse,
)
def approve(
    organization_id: UUID,
    request_id: UUID,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    _own_org(leader, organization_id)
    return svc.decide_request(
        db, leader.user, organization_id, request_id, approve=True
    )


@organization_access_router.post(
    "/{organization_id}/join-requests/{request_id}/reject",
    response_model=JoinRequestResponse,
)
def reject(
    organization_id: UUID,
    request_id: UUID,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    _own_org(leader, organization_id)
    return svc.decide_request(
        db, leader.user, organization_id, request_id, approve=False
    )


@organization_access_router.delete(
    "/{organization_id}/people/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove(
    organization_id: UUID,
    user_id: UUID,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    _own_org(leader, organization_id)
    svc.remove_member(db, leader.user, organization_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Ações em massa: as mesmas regras das individuais, item a item. Limite por
# Líder para um script não martelar a base de dados com centenas de pedidos.
BULK_RATE_LIMIT = 30
BULK_RATE_WINDOW = 300


def _bulk_response(results: list[tuple[UUID, str | None]]) -> BulkActionResponse:
    items = [BulkItemResult(id=i, ok=r is None, reason=r) for i, r in results]
    done = sum(1 for it in items if it.ok)
    return BulkActionResponse(succeeded=done, failed=len(items) - done, results=items)


@organization_access_router.post(
    "/{organization_id}/join-requests/bulk", response_model=BulkActionResponse
)
def bulk_decide(
    organization_id: UUID,
    payload: BulkJoinRequestsBody,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    """Aprova ou recusa vários pedidos (até 100). Resposta item a item."""
    _own_org(leader, organization_id)
    rate_limit.hit(f"org-bulk:{leader.user.id}", BULK_RATE_LIMIT, BULK_RATE_WINDOW)
    return _bulk_response(
        svc.bulk_decide_requests(
            db,
            leader.user,
            organization_id,
            payload.ids,
            approve=payload.action == "approve",
        )
    )


@organization_access_router.post(
    "/{organization_id}/members/bulk-remove", response_model=BulkActionResponse
)
def bulk_remove(
    organization_id: UUID,
    payload: BulkRemoveMembersBody,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    """Remove várias pessoas (até 100). Nunca o Líder nem a própria conta."""
    _own_org(leader, organization_id)
    rate_limit.hit(f"org-bulk:{leader.user.id}", BULK_RATE_LIMIT, BULK_RATE_WINDOW)
    return _bulk_response(
        svc.bulk_remove_members(db, leader.user, organization_id, payload.user_ids)
    )


@organization_access_router.post(
    "/{organization_id}/transfer-leadership", status_code=status.HTTP_204_NO_CONTENT
)
def transfer(
    organization_id: UUID,
    payload: TransferLeadershipRequest,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    _own_org(leader, organization_id)
    svc.transfer_leadership(db, leader.user, organization_id, payload.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@organization_access_router.get(
    "/{organization_id}/events", response_model=list[OrganizationEventResponse]
)
def list_events(
    organization_id: UUID,
    limit: int = Query(default=50, ge=1, le=svc.EVENTS_LIMIT_MAX),
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    """Histórico: entradas, saídas, remoções e mudanças de líder (mais recente primeiro)."""
    _own_org(leader, organization_id)
    return svc.list_events(db, organization_id, limit)

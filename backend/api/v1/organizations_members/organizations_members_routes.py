from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.organization_member_schemas import (
    OrganizationMemberResponse,
)

from services import organization_member_service

organizations_member_router = APIRouter(
    prefix="/api/v1/organizations",
    tags=["members"],
)


def _ensure_own_org(current: CurrentUser, organization_id: UUID) -> None:
    # Só a própria org — sem isto, qualquer um se adiciona a qualquer tenant.
    if organization_id != current.organization_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização"
        )


@organizations_member_router.get(
    "/{organization_id}/members",
    response_model=list[OrganizationMemberResponse],
)
def list_members(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_own_org(current, organization_id)
    return organization_member_service.list_members(db, organization_id)


# As rotas antigas de escrita (POST/PATCH/DELETE .../members) foram RETIRADAS a
# 21/10/2026. Deixavam o líder pôr qualquer conta na organização sem ela pedir,
# mudar papéis à mão (incluindo criar um segundo líder) e apagar a própria linha,
# deixando a organização sem líder. A entrada passa pelos pedidos
# (/join-requests), a saída por /people/{user_id} ou /leave e a liderança por
# /transfer-leadership — todas em organization_access_routes.py, com as regras.

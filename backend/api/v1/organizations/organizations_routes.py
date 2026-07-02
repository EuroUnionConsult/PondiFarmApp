from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user

from schemas.organization_schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)
from services import organization_service

organizations_router = APIRouter(
    prefix="/api/v1/organizations",
    tags=["organizations"],
)


def _ensure_own_org(current: CurrentUser, organization_id: UUID) -> None:
    if organization_id != current.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recurso fora da sua organização",
        )


@organizations_router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return organization_service.create_organization(db, payload)


@organizations_router.get("", response_model=list[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    # Só a própria organização — nunca a lista global.
    return [organization_service.get_organization(db, current.organization_id)]


@organizations_router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def get_organization(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_own_org(current, organization_id)
    return organization_service.get_organization(db, organization_id)


@organizations_router.patch(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def update_organization(
    organization_id: UUID,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_own_org(current, organization_id)
    return organization_service.update_organization(db, organization_id, payload)


@organizations_router.delete(
    "/{organization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_organization(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_own_org(current, organization_id)
    organization_service.delete_organization(db, organization_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

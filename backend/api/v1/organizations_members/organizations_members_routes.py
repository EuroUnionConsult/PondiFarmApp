from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.organization_member_schemas import (
    OrganizationMemberCreate,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
)

from services import organization_member_service

organizations_member_router = APIRouter(
    prefix="/api/v1/organizations",
    tags=["members"],
)

@organizations_member_router.get(
    "/{organization_id}/members",
    response_model=list[OrganizationMemberResponse],
)
def list_members(organization_id: UUID, db: Session = Depends(get_db)):
    return organization_member_service.list_members(db, organization_id)


@organizations_member_router.post(
    "/{organization_id}/members",
    response_model=OrganizationMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_member(
    organization_id: UUID,
    payload: OrganizationMemberCreate,
    db: Session = Depends(get_db),
):
    return organization_member_service.create_member(db, organization_id, payload)


@organizations_member_router.patch(
    "/{organization_id}/members/{member_id}",
    response_model=OrganizationMemberResponse,
)
def update_member(
    organization_id: UUID,
    member_id: UUID,
    payload: OrganizationMemberUpdate,
    db: Session = Depends(get_db),
):
    return organization_member_service.update_member(
        db,
        organization_id,
        member_id,
        payload,
    )


@organizations_member_router.delete(
    "/{organization_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_member(
    organization_id: UUID,
    member_id: UUID,
    db: Session = Depends(get_db),
):
    organization_member_service.delete_member(db, organization_id, member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

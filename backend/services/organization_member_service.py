from __future__ import annotations

from datetime import datetime
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import OrganizationMember
from repositories import organization_member_repository
from schemas.organization_member_schemas import (
    OrganizationMemberCreate,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
)
from services.organization_service import get_organization_entity
from services.user_service import get_user_entity

logger = logging.getLogger(__name__)


def _sanitize_for_log(value: object) -> str:
    return str(value).replace("\r", "").replace("\n", "")


def _to_response(member: OrganizationMember) -> OrganizationMemberResponse:
    return OrganizationMemberResponse.model_validate(
        {
            "id": member.id,
            "organization_id": member.organization_id,
            "user_id": member.user_id,
            "user_name": member.user.name,
            "user_email": member.user.email,
            "role": member.role,
            "created_at": member.created_at,
            "updated_at": member.updated_at,
        },
    )


def list_members(
    db: Session,
    organization_id: UUID,
) -> list[OrganizationMemberResponse]:
    get_organization_entity(db, organization_id)
    members = organization_member_repository.list_active_members_by_organization(
        db,
        organization_id,
    )
    return [_to_response(member) for member in members]


def create_member(
    db: Session,
    organization_id: UUID,
    payload: OrganizationMemberCreate,
) -> OrganizationMemberResponse:
    get_organization_entity(db, organization_id)
    get_user_entity(db, payload.user_id)

    existing = organization_member_repository.get_active_member_by_organization_and_user(
        db,
        organization_id,
        payload.user_id,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization member already exists",
        )

    existing_soft_deleted = (
        organization_member_repository.get_member_by_organization_and_user(
            db,
            organization_id,
            payload.user_id,
        )
    )
    if existing_soft_deleted and existing_soft_deleted.deleted_at is not None:
        existing_soft_deleted.deleted_at = None
        existing_soft_deleted.role = "viewer"
        existing_soft_deleted.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_soft_deleted)
        hydrated = organization_member_repository.get_active_member_by_id(
            db,
            organization_id,
            existing_soft_deleted.id,
        )
        return _to_response(hydrated)

    member = OrganizationMember(
        organization_id=organization_id,
        user_id=payload.user_id,
        role="viewer",
    )
    try:
        created = organization_member_repository.create_member(db, member)
    except IntegrityError as exc:
        db.rollback()
        error_message = str(exc.orig) if exc.orig else str(exc)
        safe_organization_id = _sanitize_for_log(organization_id)
        safe_user_id = _sanitize_for_log(payload.user_id)
        logger.exception(
            "Failed to create organization member for organization_id=%s user_id=%s",
            safe_organization_id,
            safe_user_id,
        )
        if (
            "uq_organization_members_organization_user" in error_message
            or "UNIQUE KEY constraint" in error_message
            or "duplicate key" in error_message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organization member already exists",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create organization member: {error_message}",
        ) from exc
    hydrated = organization_member_repository.get_active_member_by_id(
        db,
        organization_id,
        created.id,
    )
    return _to_response(hydrated)


def update_member(
    db: Session,
    organization_id: UUID,
    member_id: UUID,
    payload: OrganizationMemberUpdate,
) -> OrganizationMemberResponse:
    get_organization_entity(db, organization_id)
    member = organization_member_repository.get_active_member_by_id(
        db,
        organization_id,
        member_id,
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization member not found",
        )

    member.role = "viewer"
    member.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(member)
    hydrated = organization_member_repository.get_active_member_by_id(
        db,
        organization_id,
        member_id,
    )
    return _to_response(hydrated)


def delete_member(db: Session, organization_id: UUID, member_id: UUID) -> None:
    member = organization_member_repository.get_active_member_by_id(
        db,
        organization_id,
        member_id,
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization member not found",
        )
    organization_member_repository.delete_member(db, member)

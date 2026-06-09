from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import Organization
from repositories import organization_repository
from schemas.organization_schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    normalize_portuguese_nif,
)


def create_organization(
    db: Session,
    payload: OrganizationCreate,
) -> OrganizationResponse:
    normalized_document_number = normalize_portuguese_nif(payload.document_number)
    existing = organization_repository.get_organization_by_document_number(
        db,
        normalized_document_number,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization document number already exists",
        )

    organization = Organization(
        **payload.model_dump(exclude={"document_number"}),
        document_number=normalized_document_number,
    )
    try:
        created = organization_repository.create_organization(db, organization)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization document number already exists",
        ) from exc

    return OrganizationResponse.model_validate(created)


def list_organizations(db: Session) -> list[OrganizationResponse]:
    organizations = organization_repository.list_active_organizations(db)
    return [OrganizationResponse.model_validate(item) for item in organizations]


def get_organization(db: Session, organization_id: UUID) -> OrganizationResponse:
    organization = organization_repository.get_active_organization_by_id(
        db,
        organization_id,
    )
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return OrganizationResponse.model_validate(organization)


def get_organization_entity(db: Session, organization_id: UUID) -> Organization:
    organization = organization_repository.get_active_organization_by_id(
        db,
        organization_id,
    )
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return organization


def update_organization(
    db: Session,
    organization_id: UUID,
    payload: OrganizationUpdate,
) -> OrganizationResponse:
    organization = get_organization_entity(db, organization_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "document_number" in update_data and update_data["document_number"]:
        normalized_document_number = normalize_portuguese_nif(
            update_data["document_number"],
        )
        existing = organization_repository.get_organization_by_document_number(
            db,
            normalized_document_number,
        )
        if existing and existing.id != organization.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organization document number already exists",
            )
        update_data["document_number"] = normalized_document_number
    elif "document_number" in update_data:
        update_data["document_number"] = normalize_portuguese_nif(
            update_data["document_number"],
        )

    for field, value in update_data.items():
        setattr(organization, field, value)

    organization.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(organization)
    return OrganizationResponse.model_validate(organization)


def delete_organization(db: Session, organization_id: UUID) -> None:
    organization = get_organization_entity(db, organization_id)
    organization_repository.delete_organization(db, organization)

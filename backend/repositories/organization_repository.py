from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import Organization


def create_organization(db: Session, organization: Organization) -> Organization:
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def list_active_organizations(db: Session) -> list[Organization]:
    statement = (
        select(Organization)
        .where(Organization.deleted_at.is_(None))
        .order_by(Organization.created_at.asc())
    )
    return list(db.scalars(statement).all())


def get_active_organization_by_id(
    db: Session,
    organization_id: UUID,
) -> Organization | None:
    statement = select(Organization).where(
        Organization.id == organization_id,
        Organization.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_active_organization_by_document_number(
    db: Session,
    document_number: str,
) -> Organization | None:
    statement = select(Organization).where(
        Organization.document_number == document_number,
        Organization.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_organization_by_document_number(
    db: Session,
    document_number: str,
) -> Organization | None:
    statement = select(Organization).where(
        Organization.document_number == document_number,
    )
    return db.scalar(statement)


def delete_organization(db: Session, organization: Organization) -> None:
    now = datetime.utcnow()
    organization.deleted_at = now
    organization.updated_at = now
    db.commit()

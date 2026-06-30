from __future__ import annotations

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models.models import AnimalDocument


def create_document(db: Session, document: AnimalDocument) -> AnimalDocument:
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def get_active_document_by_id(
    db: Session,
    document_id: UUID,
) -> AnimalDocument | None:
    statement = select(AnimalDocument).where(
        AnimalDocument.id == document_id,
        AnimalDocument.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_document_by_id(db: Session, document_id: UUID) -> AnimalDocument | None:
    return db.get(AnimalDocument, document_id)


def list_documents(
    db: Session,
    organization_id: UUID | None,
    animal_id: UUID | None,
    document_type: str | None,
    document_status: str | None,
    expires_before: date | None,
    expires_after: date | None,
    include_expired: bool,
    include_archived: bool,
    expiring_within_days: int | None,
    page: int,
    limit: int,
) -> list[AnimalDocument]:
    today = date.today()
    statement = select(AnimalDocument).where(AnimalDocument.deleted_at.is_(None))

    if organization_id is not None:
        statement = statement.where(AnimalDocument.organization_id == organization_id)
    if animal_id is not None:
        statement = statement.where(AnimalDocument.animal_id == animal_id)
    if document_type is not None:
        statement = statement.where(AnimalDocument.document_type == document_type)
    if document_status is not None:
        statement = statement.where(AnimalDocument.status == document_status)
    elif not include_archived:
        statement = statement.where(AnimalDocument.status != "archived")
    if expires_before is not None:
        statement = statement.where(AnimalDocument.expires_at < expires_before)
    if expires_after is not None:
        statement = statement.where(AnimalDocument.expires_at > expires_after)
    if not include_expired:
        statement = statement.where(
            or_(
                AnimalDocument.expires_at.is_(None),
                AnimalDocument.expires_at >= today,
            ),
        )
    if expiring_within_days is not None:
        expiration_limit = today + timedelta(days=expiring_within_days)
        statement = statement.where(
            AnimalDocument.status == "active",
            AnimalDocument.expires_at >= today,
            AnimalDocument.expires_at <= expiration_limit,
        )

    statement = statement.order_by(
        AnimalDocument.created_at.desc(),
        AnimalDocument.id.asc(),
    )
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())


def save_document(db: Session, document: AnimalDocument) -> AnimalDocument:
    db.commit()
    db.refresh(document)
    return document


def soft_delete_document(db: Session, document: AnimalDocument) -> None:
    now = datetime.utcnow()
    document.deleted_at = now
    document.updated_at = now
    db.commit()

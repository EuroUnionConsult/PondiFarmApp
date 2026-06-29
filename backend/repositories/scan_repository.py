from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import AnimalScan


def create_scan(db: Session, scan: AnimalScan) -> AnimalScan:
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def get_active_scan_by_id(db: Session, scan_id: UUID) -> AnimalScan | None:
    statement = select(AnimalScan).where(
        AnimalScan.id == scan_id,
        AnimalScan.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_active_unfinished_scan_by_animal_id(
    db: Session,
    animal_id: UUID,
    unfinished_statuses: tuple[str, ...],
    exclude_scan_id: UUID | None = None,
) -> AnimalScan | None:
    statement = select(AnimalScan).where(
        AnimalScan.animal_id == animal_id,
        AnimalScan.scan_status.in_(unfinished_statuses),
        AnimalScan.deleted_at.is_(None),
    )
    if exclude_scan_id is not None:
        statement = statement.where(AnimalScan.id != exclude_scan_id)
    statement = statement.order_by(AnimalScan.created_at.desc()).limit(1)
    return db.scalar(statement)


def list_active_scans_by_animal(
    db: Session,
    animal_id: UUID,
    scan_status: str | None,
    scan_source: str | None,
    scanned_from: datetime | None,
    scanned_to_exclusive: datetime | None,
    page: int,
    limit: int,
) -> list[AnimalScan]:
    statement = select(AnimalScan).where(
        AnimalScan.animal_id == animal_id,
        AnimalScan.deleted_at.is_(None),
    )

    if scan_status is not None:
        statement = statement.where(AnimalScan.scan_status == scan_status)

    if scan_source is not None:
        statement = statement.where(AnimalScan.scan_source == scan_source)

    if scanned_from is not None:
        statement = statement.where(AnimalScan.scanned_at >= scanned_from)

    if scanned_to_exclusive is not None:
        statement = statement.where(AnimalScan.scanned_at < scanned_to_exclusive)

    statement = statement.order_by(
        AnimalScan.scanned_at.desc(),
        AnimalScan.created_at.desc(),
    )
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())

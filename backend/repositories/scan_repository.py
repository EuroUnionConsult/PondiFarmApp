from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import AnimalScan


def get_active_scan_by_id(db: Session, scan_id: UUID) -> AnimalScan | None:
    statement = select(AnimalScan).where(
        AnimalScan.id == scan_id,
        AnimalScan.deleted_at.is_(None),
    )
    return db.scalar(statement)


def save_scan(db: Session, scan: AnimalScan) -> AnimalScan:
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan

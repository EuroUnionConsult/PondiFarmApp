from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.models import AnimalScan


def create_scan(db: Session, scan: AnimalScan) -> AnimalScan:
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def get_scan_by_client_id(db: Session, client_scan_id: str) -> AnimalScan | None:
    """Idempotência (C4): acha um scan já criado pelo mesmo id de device."""
    statement = select(AnimalScan).where(
        AnimalScan.client_scan_id == client_scan_id,
        AnimalScan.deleted_at.is_(None),
    )
    return db.scalar(statement)


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


# Estados que a app não mostra como «último peso» (iguais ao HIDDEN_SCAN_STATUSES
# do mobile/src/lib/api.ts).
HIDDEN_SCAN_STATUSES = ("archived", "failed", "validation_failed")


def list_latest_usable_scans_by_organization(
    db: Session, organization_id: UUID
) -> list[AnimalScan]:
    """O scan mais recente de cada animal da organização, numa só consulta.

    Substitui o pedido `/animals/{id}/scans` por animal que a app fazia: com 290
    animais eram 290 pedidos (22 s medidos em produção a 21/10/2026), que
    entupiam a ligação e atrasavam tudo o resto, aprovações incluídas.
    """
    ranked = (
        select(
            AnimalScan.id,
            func.row_number()
            .over(
                partition_by=AnimalScan.animal_id,
                order_by=(AnimalScan.scanned_at.desc(), AnimalScan.created_at.desc()),
            )
            .label("rn"),
        )
        .where(
            AnimalScan.organization_id == organization_id,
            AnimalScan.deleted_at.is_(None),
            AnimalScan.scan_status.not_in(HIDDEN_SCAN_STATUSES),
        )
        .subquery()
    )
    statement = (
        select(AnimalScan)
        .join(ranked, AnimalScan.id == ranked.c.id)
        .where(ranked.c.rn == 1)
    )
    return list(db.scalars(statement).all())

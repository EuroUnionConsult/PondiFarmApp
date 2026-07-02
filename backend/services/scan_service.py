from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.models import AnimalScan
from repositories import scan_repository
from schemas.scan_schemas import (
    AnimalScanCreate,
    AnimalScanResponse,
    AnimalScanUpdate,
    ScanSource,
    ScanStatus,
    build_end_of_day_exclusive,
    build_start_of_day,
)
from services import animal_service

ACTIVE_UNFINISHED_SCAN_STATUSES: tuple[ScanStatus, ...] = (
    "pending_upload",
    "uploaded",
    "validating",
    "processing",
)

ALLOWED_SCAN_STATUS_TRANSITIONS: dict[ScanStatus, set[ScanStatus]] = {
    "pending_upload": {"uploaded", "archived"},
    "uploaded": {"validating", "failed"},
    "validating": {"processing", "validation_failed"},
    "processing": {"completed", "failed"},
    "validation_failed": {"archived"},
    "completed": {"archived"},
    "failed": {"archived"},
    "archived": set(),
}


def _normalize_scanned_at(value: datetime | None) -> datetime:
    if value is None:
        return datetime.utcnow()
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _set_scan_status(
    db: Session,
    scan: AnimalScan,
    next_status: ScanStatus,
) -> None:
    if next_status == scan.scan_status:
        return

    allowed_statuses = ALLOWED_SCAN_STATUS_TRANSITIONS[scan.scan_status]
    if next_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot change scan status from {scan.scan_status} to {next_status}"
            ),
        )

    if next_status in ACTIVE_UNFINISHED_SCAN_STATUSES:
        other_active_scan = scan_repository.get_active_unfinished_scan_by_animal_id(
            db,
            scan.animal_id,
            ACTIVE_UNFINISHED_SCAN_STATUSES,
            exclude_scan_id=scan.id,
        )
        if other_active_scan is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Animal already has an active unfinished scan",
            )

    scan.scan_status = next_status


def create_scan(
    db: Session,
    animal_id: UUID,
    payload: AnimalScanCreate,
) -> AnimalScanResponse:
    animal = animal_service.get_animal_entity(db, animal_id)
    # Só barra se o NOVO scan for "ativo não terminado" (ex.: upload em curso).
    # Scans do app já vêm `completed` (processados no device) → múltiplos por animal OK.
    if payload.scan_status in ACTIVE_UNFINISHED_SCAN_STATUSES:
        existing = scan_repository.get_active_unfinished_scan_by_animal_id(
            db,
            animal.id,
            ACTIVE_UNFINISHED_SCAN_STATUSES,
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Animal already has an active unfinished scan",
            )

    scan = AnimalScan(
        animal_id=animal.id,
        organization_id=animal.organization_id,
        scan_status=payload.scan_status,
        scan_source=payload.scan_source,
        scanned_at=_normalize_scanned_at(payload.scanned_at),
        estimated_weight=payload.estimated_weight,
        confidence_score=payload.confidence_score,
        body_length=payload.body_length,
        withers_height=payload.withers_height,
        chest_circumference=payload.chest_circumference,
        hip_width=payload.hip_width,
        raw_result_json=payload.raw_result_json,
        notes=_normalize_optional_string(payload.notes),
    )
    created = scan_repository.create_scan(db, scan)
    return AnimalScanResponse.model_validate(created)


def list_scans(
    db: Session,
    animal_id: UUID,
    scan_status: ScanStatus | None,
    scan_source: ScanSource | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    limit: int,
) -> list[AnimalScanResponse]:
    # TODO: enforce organization membership and authorization when auth is available.
    animal_service.get_animal_entity(db, animal_id)

    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dateFrom cannot be after dateTo",
        )

    scans = scan_repository.list_active_scans_by_animal(
        db,
        animal_id,
        scan_status,
        scan_source,
        build_start_of_day(date_from) if date_from is not None else None,
        build_end_of_day_exclusive(date_to) if date_to is not None else None,
        page,
        limit,
    )
    return [AnimalScanResponse.model_validate(item) for item in scans]


def get_scan(db: Session, scan_id: UUID) -> AnimalScanResponse:
    scan = get_scan_entity(db, scan_id)
    return AnimalScanResponse.model_validate(scan)


def get_scan_entity(db: Session, scan_id: UUID) -> AnimalScan:
    scan = scan_repository.get_active_scan_by_id(db, scan_id)
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    return scan


def update_scan(
    db: Session,
    scan_id: UUID,
    payload: AnimalScanUpdate,
) -> AnimalScanResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    scan = get_scan_entity(db, scan_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "scan_status" in update_data and update_data["scan_status"] is not None:
        _set_scan_status(db, scan, update_data["scan_status"])

    if "scanned_at" in update_data:
        scan.scanned_at = _normalize_scanned_at(update_data["scanned_at"])

    if "notes" in update_data:
        scan.notes = _normalize_optional_string(update_data["notes"])

    scan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(scan)
    return AnimalScanResponse.model_validate(scan)


def delete_scan(db: Session, scan_id: UUID) -> None:
    # TODO: enforce organization membership and authorization when auth is available.
    scan = get_scan_entity(db, scan_id)

    if scan.scan_status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a scan while it is processing",
        )

    if scan.scan_status == "completed":
        scan.scan_status = "archived"
        scan.updated_at = datetime.utcnow()
        db.commit()
        return

    scan.deleted_at = datetime.utcnow()
    scan.updated_at = datetime.utcnow()
    db.commit()

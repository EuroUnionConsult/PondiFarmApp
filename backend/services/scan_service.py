from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.models import AnimalScan
from prediction.model_registry import get_model_registry
from prediction.schemas import WeightEstimationRequest
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
    # TODO: enforce organization membership and authorization when auth is available.
    animal = animal_service.get_animal_entity(db, animal_id)
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
        scan_status="pending_upload",
        scan_source=payload.scan_source,
        scanned_at=_normalize_scanned_at(payload.scanned_at),
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


# Measurements the morphometric formula strictly needs to estimate weight.
# ``chest_circumference`` is the heart girth used by the baseline formula and
# ``body_length`` is its second input. Both are mapped onto the prediction
# request below.
REQUIRED_ESTIMATION_COLUMNS: tuple[str, ...] = (
    "chest_circumference",
    "body_length",
)

# Optional measurements that refine the plausibility diagnostics but are not
# required by the weight formula itself. When present they must still be valid
# (greater than zero); when absent, plausible bovine defaults are used so the
# prediction request can be validated.
OPTIONAL_ESTIMATION_COLUMNS: tuple[str, ...] = (
    "withers_height",
    "hip_width",
)

# Plausible bovine fallbacks (in centimetres) for measurements that the current
# scan schema does not persist or that were left blank. They sit comfortably
# inside the predictor's plausible ranges and never affect the estimated weight,
# which depends only on chest circumference and body length.
_MEASUREMENT_FALLBACKS: dict[str, float] = {
    "withers_height_cm": 130.0,
    "thoracic_depth_cm": 65.0,
    "rump_width_cm": 50.0,
}


def estimate_scan_weight(db: Session, scan_id: UUID) -> AnimalScanResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    scan = get_scan_entity(db, scan_id)
    _validate_estimation_measurements(scan)

    scan.scan_status = "processing"
    scan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(scan)

    try:
        predictor = get_model_registry().get_default()
        prediction_request = _build_prediction_request(scan)
        result = predictor.predict(prediction_request)

        scan.estimated_weight = result.estimated_weight_kg
        scan.confidence_score = result.confidence_score
        scan.raw_result_json = result.model_dump(mode="json")
        scan.scan_status = "completed"
        scan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(scan)
        return AnimalScanResponse.model_validate(scan)
    except Exception as exc:
        db.rollback()
        _mark_scan_failed(db, scan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weight estimation failed unexpectedly",
        ) from exc


def _validate_estimation_measurements(scan: AnimalScan) -> None:
    missing = [
        column
        for column in REQUIRED_ESTIMATION_COLUMNS
        if getattr(scan, column) is None
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "Scan is missing measurements required for weight estimation"
                ),
                "missingMeasurements": missing,
            },
        )

    invalid = [
        column
        for column in (*REQUIRED_ESTIMATION_COLUMNS, *OPTIONAL_ESTIMATION_COLUMNS)
        if getattr(scan, column) is not None and getattr(scan, column) <= 0
    ]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Scan measurements must be greater than zero",
                "invalidMeasurements": invalid,
            },
        )


def _build_prediction_request(scan: AnimalScan) -> WeightEstimationRequest:
    return WeightEstimationRequest(
        species="cattle",
        breed="unknown",
        sex="unknown",
        age_months=0,
        measurements={
            "chest_girth_cm": scan.chest_circumference,
            "body_length_cm": scan.body_length,
            "withers_height_cm": scan.withers_height
            or _MEASUREMENT_FALLBACKS["withers_height_cm"],
            "rump_width_cm": scan.hip_width or _MEASUREMENT_FALLBACKS["rump_width_cm"],
            "thoracic_depth_cm": _MEASUREMENT_FALLBACKS["thoracic_depth_cm"],
        },
    )


def _mark_scan_failed(db: Session, scan_id: UUID) -> None:
    scan = scan_repository.get_active_scan_by_id(db, scan_id)
    if scan is None:
        return
    scan.scan_status = "failed"
    scan.updated_at = datetime.utcnow()
    db.commit()


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

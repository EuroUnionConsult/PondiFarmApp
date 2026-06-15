from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.models import AnimalScan
from prediction.model_registry import get_model_registry
from prediction.schemas import WeightEstimationRequest
from repositories import scan_repository
from schemas.scan_schemas import AnimalScanResponse


REQUIRED_ESTIMATION_MEASUREMENTS = (
    "body_length_cm",
    "chest_girth_cm",
)
ESTIMATION_MEASUREMENT_FIELDS = (
    "body_length_cm",
    "chest_girth_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
)


def estimate_scan_weight(db: Session, scan_id: UUID) -> AnimalScanResponse:
    scan = _get_active_scan_or_404(db, scan_id)
    _validate_required_measurements(scan)

    scan.scan_status = "processing"
    scan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(scan)

    try:
        predictor = get_model_registry().get_default()
        prediction_request = _build_prediction_request(scan)
        result = predictor.predict(prediction_request)
        result_payload = result.model_dump(mode="json")

        scan.estimated_weight_kg = result.estimated_weight_kg
        scan.confidence_score = result.confidence_score
        scan.raw_result_json = result_payload
        scan.scan_status = "completed"
        scan.updated_at = datetime.utcnow()

        saved_scan = scan_repository.save_scan(db, scan)
        return _build_scan_response(saved_scan)
    except Exception as exc:
        db.rollback()
        _mark_scan_failed(db, scan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weight estimation failed unexpectedly",
        ) from exc


def _get_active_scan_or_404(db: Session, scan_id: UUID) -> AnimalScan:
    scan = scan_repository.get_active_scan_by_id(db, scan_id)
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    return scan


def _validate_required_measurements(scan: AnimalScan) -> None:
    missing_fields = [
        field_name
        for field_name in REQUIRED_ESTIMATION_MEASUREMENTS
        if getattr(scan, field_name) is None
    ]
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Scan is missing measurements required for weight estimation",
                "missingMeasurements": missing_fields,
            },
        )

    invalid_fields = [
        field_name
        for field_name in ESTIMATION_MEASUREMENT_FIELDS
        if getattr(scan, field_name) is not None and getattr(scan, field_name) <= 0
    ]
    if invalid_fields:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Scan measurements must be greater than zero",
                "invalidMeasurements": invalid_fields,
            },
        )


def _build_prediction_request(scan: AnimalScan) -> WeightEstimationRequest:
    return WeightEstimationRequest(
        species="cattle",
        breed="unknown",
        sex="unknown",
        age_months=0,
        measurements={
            "body_length_cm": scan.body_length_cm,
            "withers_height_cm": scan.withers_height_cm,
            "thoracic_depth_cm": scan.thoracic_depth_cm,
            "rump_width_cm": scan.rump_width_cm,
            "chest_girth_cm": scan.chest_girth_cm,
        },
    )


def _mark_scan_failed(db: Session, scan_id: UUID) -> None:
    scan = scan_repository.get_active_scan_by_id(db, scan_id)
    if scan is None:
        return

    scan.scan_status = "failed"
    scan.updated_at = datetime.utcnow()
    db.commit()


def _build_scan_response(scan: AnimalScan) -> AnimalScanResponse:
    response = AnimalScanResponse.model_validate(scan)
    response.diagnostics = scan.estimation_diagnostics_json
    return response

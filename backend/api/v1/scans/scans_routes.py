from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.scan_schemas import (
    AnimalScanCreate,
    AnimalScanResponse,
    AnimalScanUpdate,
    ScanSource,
    ScanStatus,
)
from services import scan_service

scans_router = APIRouter(prefix="/api/v1", tags=["animal-scans"])


@scans_router.post(
    "/animals/{animal_id}/scans",
    response_model=AnimalScanResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scan(
    animal_id: UUID,
    payload: AnimalScanCreate,
    db: Session = Depends(get_db),
):
    return scan_service.create_scan(db, animal_id, payload)


@scans_router.get(
    "/animals/{animal_id}/scans",
    response_model=list[AnimalScanResponse],
)
def list_animal_scans(
    animal_id: UUID,
    scan_status: ScanStatus | None = Query(default=None, alias="status"),
    scan_source: ScanSource | None = Query(default=None, alias="source"),
    date_from: date | None = Query(default=None, alias="dateFrom"),
    date_to: date | None = Query(default=None, alias="dateTo"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return scan_service.list_scans(
        db,
        animal_id,
        scan_status,
        scan_source,
        date_from,
        date_to,
        page,
        limit,
    )


@scans_router.get("/scans/{scan_id}", response_model=AnimalScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db)):
    return scan_service.get_scan(db, scan_id)


@scans_router.post(
    "/scans/{scan_id}/estimate-weight",
    response_model=AnimalScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate and persist weight for an existing scan",
)
def estimate_scan_weight(scan_id: UUID, db: Session = Depends(get_db)):
    return scan_service.estimate_scan_weight(db, scan_id)


@scans_router.patch("/scans/{scan_id}", response_model=AnimalScanResponse)
def update_scan(
    scan_id: UUID,
    payload: AnimalScanUpdate,
    db: Session = Depends(get_db),
):
    return scan_service.update_scan(db, scan_id, payload)


@scans_router.delete("/scans/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(scan_id: UUID, db: Session = Depends(get_db)):
    scan_service.delete_scan(db, scan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

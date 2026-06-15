from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.scan_schemas import AnimalScanResponse
from services import scan_service


scans_router = APIRouter(
    prefix="/api/v1/scans",
    tags=["scans"],
)


@scans_router.post(
    "/{scan_id}/estimate-weight",
    response_model=AnimalScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate and persist weight for an existing scan",
)
def estimate_scan_weight(
    scan_id: UUID,
    db: Session = Depends(get_db),
) -> AnimalScanResponse:
    return scan_service.estimate_scan_weight(db, scan_id)

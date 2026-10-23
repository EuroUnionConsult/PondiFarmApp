from datetime import date
from uuid import UUID

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.scan_schemas import (
    AnimalScanCreate,
    AnimalScanResponse,
    AnimalScanUpdate,
    ScanSource,
    ScanStatus,
)
from models.models import MESH_MAX_BYTES
from services import animal_service, scan_mesh_service, scan_service

scans_router = APIRouter(prefix="/api/v1", tags=["animal-scans"])


def _ensure_animal_in_org(db: Session, current: CurrentUser, animal_id: UUID) -> None:
    """O animal (dono do scan) tem de pertencer à org do token."""
    animal = animal_service.get_animal_entity(db, animal_id)
    if animal.organization_id != current.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recurso fora da sua organização",
        )


@scans_router.post(
    "/animals/{animal_id}/scans",
    response_model=AnimalScanResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scan(
    animal_id: UUID,
    payload: AnimalScanCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_animal_in_org(db, current, animal_id)
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
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_animal_in_org(db, current, animal_id)
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
def get_scan(
    scan_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    return AnimalScanResponse.model_validate(scan)


@scans_router.post(
    "/scans/{scan_id}/estimate-weight",
    response_model=AnimalScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate and persist weight for an existing scan",
)
def estimate_scan_weight(
    scan_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    return scan_service.estimate_scan_weight(db, scan_id)


@scans_router.patch("/scans/{scan_id}", response_model=AnimalScanResponse)
def update_scan(
    scan_id: UUID,
    payload: AnimalScanUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    return scan_service.update_scan(db, scan_id, payload)


@scans_router.delete("/scans/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    scan_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    scan_service.delete_scan(db, scan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _read_limited(request: Request, limit: int) -> bytes:
    """Lê o corpo até `limit` bytes; acima disso responde 413 sem ler o resto."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Malha demasiado grande")
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Malha demasiado grande")
        chunks.append(chunk)
    return b"".join(chunks)


@scans_router.put(
    "/scans/{scan_id}/mesh",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Upload the 3D model of a scan (raw body; PLY, OBJ or GLB)",
)
async def upload_scan_mesh(
    scan_id: UUID,
    request: Request,
    mesh_format: Literal["ply", "obj", "glb"] = Query(alias="format"),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    data = await _read_limited(request, MESH_MAX_BYTES)
    scan_mesh_service.save_mesh(db, scan, current.user.id, mesh_format, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scans_router.get("/scans/{scan_id}/mesh", summary="Download the 3D model of a scan")
def get_scan_mesh(
    scan_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    scan = scan_service.get_scan_entity(db, scan_id)
    _ensure_animal_in_org(db, current, scan.animal_id)
    mesh = scan_mesh_service.get_mesh(db, scan)
    return Response(
        content=mesh.data,
        media_type=scan_mesh_service.MEDIA_TYPES[mesh.mesh_format],
        headers={
            "X-Mesh-Format": mesh.mesh_format,
            "Content-Disposition": f'inline; filename="scan-{scan_id}.{mesh.mesh_format}"',
            # Privado: só o browser de quem tem sessão guarda; o modelo não muda sem novo upload.
            "Cache-Control": "private, max-age=3600",
        },
    )

from datetime import date
from io import BytesIO
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.animal_document_schemas import (
    AnimalDocumentResponse,
    AnimalDocumentUpdate,
    AnimalDocumentUploadMetadata,
    DocumentStatus,
    DocumentType,
)
from services import animal_document_service, animal_service

animal_documents_router = APIRouter(prefix="/api/v1", tags=["animal-documents"])


# Isolamento multi-tenant: barra acesso se o recurso não for da org do token.
def _ensure_animal_in_org(db: Session, current: CurrentUser, animal_id: UUID) -> None:
    animal = animal_service.get_animal_entity(db, animal_id)
    if animal.organization_id != current.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização")


def _ensure_document_in_org(db: Session, current: CurrentUser, document_id: UUID) -> None:
    document = animal_document_service.get_document_entity(db, document_id)
    if document.organization_id != current.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização")


def _ensure_own_org(current: CurrentUser, organization_id: UUID) -> None:
    if organization_id != current.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização")


@animal_documents_router.post(
    "/animals/{animal_id}/documents",
    response_model=AnimalDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_animal_document(
    animal_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(..., alias="documentType"),
    issued_at: date | None = Form(default=None, alias="issuedAt"),
    expires_at: date | None = Form(default=None, alias="expiresAt"),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_animal_in_org(db, current, animal_id)
    form = await request.form()
    allowed_fields = {"file", "documentType", "issuedAt", "expiresAt"}
    forbidden_fields = sorted(set(form.keys()) - allowed_fields)
    if forbidden_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported multipart fields: {', '.join(forbidden_fields)}",
        )
    metadata = AnimalDocumentUploadMetadata(
        document_type=document_type,
        issued_at=issued_at,
        expires_at=expires_at,
    )
    return await animal_document_service.upload_document(
        db,
        animal_id,
        file,
        metadata,
    )


@animal_documents_router.get(
    "/animals/{animal_id}/documents",
    response_model=list[AnimalDocumentResponse],
)
def list_animal_documents(
    animal_id: UUID,
    document_type: DocumentType | None = Query(default=None, alias="documentType"),
    document_status: DocumentStatus | None = Query(default=None, alias="status"),
    expires_before: date | None = Query(default=None, alias="expiresBefore"),
    expires_after: date | None = Query(default=None, alias="expiresAfter"),
    include_expired: bool = Query(default=True, alias="includeExpired"),
    include_archived: bool = Query(default=False, alias="includeArchived"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_animal_in_org(db, current, animal_id)
    return animal_document_service.list_documents_for_animal(
        db,
        animal_id,
        document_type,
        document_status,
        expires_before,
        expires_after,
        include_expired,
        include_archived,
        page,
        limit,
    )


@animal_documents_router.get(
    "/organizations/{organization_id}/documents",
    response_model=list[AnimalDocumentResponse],
)
def list_organization_documents(
    organization_id: UUID,
    animal_id: UUID | None = Query(default=None, alias="animalId"),
    document_type: DocumentType | None = Query(default=None, alias="documentType"),
    document_status: DocumentStatus | None = Query(default=None, alias="status"),
    expires_before: date | None = Query(default=None, alias="expiresBefore"),
    expires_after: date | None = Query(default=None, alias="expiresAfter"),
    expiring_within_days: int | None = Query(
        default=None,
        alias="expiringWithinDays",
        ge=1,
        le=365,
    ),
    include_expired: bool = Query(default=True, alias="includeExpired"),
    include_archived: bool = Query(default=False, alias="includeArchived"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_own_org(current, organization_id)
    return animal_document_service.list_documents_for_organization(
        db,
        organization_id,
        animal_id,
        document_type,
        document_status,
        expires_before,
        expires_after,
        expiring_within_days,
        include_expired,
        include_archived,
        page,
        limit,
    )


@animal_documents_router.get(
    "/documents/{document_id}",
    response_model=AnimalDocumentResponse,
)
def get_animal_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_document_in_org(db, current, document_id)
    return animal_document_service.get_document(db, document_id)


@animal_documents_router.get("/documents/{document_id}/download")
def download_animal_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_document_in_org(db, current, document_id)
    download = animal_document_service.download_document(db, document_id)
    headers = {
        "Content-Disposition": f'attachment; filename="{download.file_name}"',
        "Content-Length": str(len(download.content)),
        "X-Document-Id": str(download.document_id),
    }
    return StreamingResponse(
        BytesIO(download.content),
        media_type=download.content_type,
        headers=headers,
    )


@animal_documents_router.patch(
    "/documents/{document_id}",
    response_model=AnimalDocumentResponse,
)
def update_animal_document(
    document_id: UUID,
    payload: AnimalDocumentUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_document_in_org(db, current, document_id)
    return animal_document_service.update_document(db, document_id, payload)


@animal_documents_router.post(
    "/documents/{document_id}/archive",
    response_model=AnimalDocumentResponse,
)
def archive_animal_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_document_in_org(db, current, document_id)
    return animal_document_service.archive_document(db, document_id)


@animal_documents_router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_animal_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_document_in_org(db, current, document_id)
    animal_document_service.delete_document(db, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

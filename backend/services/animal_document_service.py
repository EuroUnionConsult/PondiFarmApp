from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
import re
import unicodedata
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.config import get_settings
from models.models import AnimalDocument
from repositories import animal_document_repository
from schemas.animal_document_schemas import (
    AnimalDocumentResponse,
    AnimalDocumentUpdate,
    AnimalDocumentUploadMetadata,
    DocumentStatus,
    DocumentType,
)
from services import animal_service, organization_service, user_service
from storage.document_storage import (
    StoredDocumentNotFoundError,
    get_document_storage,
)

ALLOWED_FILE_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


@dataclass(frozen=True)
class DocumentDownload:
    document_id: UUID
    file_name: str
    content_type: str
    content: bytes


def _sanitize_file_name(file_name: str) -> str:
    base_name = file_name.replace("\\", "/").split("/")[-1]
    normalized = unicodedata.normalize("NFKC", base_name).strip()
    extension = Path(normalized).suffix.lower()
    stem = normalized[: -len(extension)] if extension else normalized
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("._-")
    safe_stem = safe_stem or "document"
    maximum_stem_length = 255 - len(extension)
    return f"{safe_stem[:maximum_stem_length]}{extension}"


def _has_valid_signature(extension: str, content: bytes) -> bool:
    if extension == ".pdf":
        return content.startswith(b"%PDF-")
    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp":
        return (
            len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        )
    return False


def _validate_file(file_name: str, content_type: str | None, content: bytes) -> str:
    sanitized_file_name = _sanitize_file_name(file_name)
    extension = Path(sanitized_file_name).suffix.lower()
    expected_content_type = ALLOWED_FILE_TYPES.get(extension)
    declared_content_type = (content_type or "").split(";", 1)[0].strip().lower()
    if expected_content_type is None or declared_content_type != expected_content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported document extension or MIME type",
        )
    if not _has_valid_signature(extension, content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document content does not match its declared file type",
        )
    return sanitized_file_name


def _validate_dates(issued_at: date | None, expires_at: date | None) -> None:
    if issued_at is not None and expires_at is not None and expires_at < issued_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expiresAt cannot be earlier than issuedAt",
        )


async def upload_document(
    db: Session,
    animal_id: UUID,
    file: UploadFile,
    metadata: AnimalDocumentUploadMetadata,
    authenticated_user_id: UUID | None = None,
) -> AnimalDocumentResponse:
    # TODO: enforce organization membership when authenticated user context is wired.
    animal = animal_service.get_animal_entity(db, animal_id)
    if authenticated_user_id is not None:
        user_service.get_user_entity(db, authenticated_user_id)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A document file name is required",
        )

    maximum_size = get_settings().document_max_file_size_bytes
    content = await file.read(maximum_size + 1)
    if len(content) > maximum_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document exceeds the maximum size of {maximum_size} bytes",
        )
    sanitized_file_name = _validate_file(file.filename, file.content_type, content)
    _validate_dates(metadata.issued_at, metadata.expires_at)

    storage = get_document_storage()
    locator = storage.save(animal.id, sanitized_file_name, content)
    document = AnimalDocument(
        organization_id=animal.organization_id,
        animal_id=animal.id,
        document_type=metadata.document_type,
        file_name=sanitized_file_name,
        file_url=locator,
        status="active",
        issued_at=metadata.issued_at,
        expires_at=metadata.expires_at,
        uploaded_by_user_id=authenticated_user_id,
    )
    try:
        created = animal_document_repository.create_document(db, document)
    except Exception:
        db.rollback()
        storage.delete(locator)
        raise
    return AnimalDocumentResponse.model_validate(created)


def list_documents_for_animal(
    db: Session,
    animal_id: UUID,
    document_type: DocumentType | None,
    document_status: DocumentStatus | None,
    expires_before: date | None,
    expires_after: date | None,
    include_expired: bool,
    include_archived: bool,
    page: int,
    limit: int,
    authenticated_user_id: UUID | None = None,
) -> list[AnimalDocumentResponse]:
    # TODO: enforce organization membership when authenticated user context is wired.
    animal_service.get_animal_entity(db, animal_id)
    _validate_expiration_filters(expires_before, expires_after)
    documents = animal_document_repository.list_documents(
        db,
        None,
        animal_id,
        document_type,
        document_status,
        expires_before,
        expires_after,
        include_expired,
        include_archived,
        None,
        page,
        limit,
    )
    return [AnimalDocumentResponse.model_validate(item) for item in documents]


def list_documents_for_organization(
    db: Session,
    organization_id: UUID,
    animal_id: UUID | None,
    document_type: DocumentType | None,
    document_status: DocumentStatus | None,
    expires_before: date | None,
    expires_after: date | None,
    expiring_within_days: int | None,
    include_expired: bool,
    include_archived: bool,
    page: int,
    limit: int,
    authenticated_user_id: UUID | None = None,
) -> list[AnimalDocumentResponse]:
    # TODO: enforce organization membership when authenticated user context is wired.
    organization_service.get_organization_entity(db, organization_id)
    _validate_expiration_filters(expires_before, expires_after)
    if animal_id is not None:
        animal = animal_service.get_animal_entity(db, animal_id)
        if animal.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Animal not found in organization",
            )

    documents = animal_document_repository.list_documents(
        db,
        organization_id,
        animal_id,
        document_type,
        document_status,
        expires_before,
        expires_after,
        include_expired,
        include_archived,
        expiring_within_days,
        page,
        limit,
    )
    return [AnimalDocumentResponse.model_validate(item) for item in documents]


def _validate_expiration_filters(
    expires_before: date | None,
    expires_after: date | None,
) -> None:
    if (
        expires_before is not None
        and expires_after is not None
        and expires_after >= expires_before
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expiresAfter must be earlier than expiresBefore",
        )


def get_document_entity(db: Session, document_id: UUID) -> AnimalDocument:
    document = animal_document_repository.get_active_document_by_id(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal document not found",
        )
    return document


def get_document(
    db: Session,
    document_id: UUID,
    authenticated_user_id: UUID | None = None,
) -> AnimalDocumentResponse:
    # TODO: enforce organization membership when authenticated user context is wired.
    return AnimalDocumentResponse.model_validate(get_document_entity(db, document_id))


def download_document(
    db: Session,
    document_id: UUID,
    authenticated_user_id: UUID | None = None,
) -> DocumentDownload:
    # TODO: enforce organization membership before reading private storage.
    document = get_document_entity(db, document_id)
    if document.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived documents cannot be downloaded",
        )
    try:
        content = get_document_storage().read(document.file_url)
    except StoredDocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored document file not found",
        ) from exc
    content_type = ALLOWED_FILE_TYPES[Path(document.file_name).suffix.lower()]
    return DocumentDownload(
        document_id=document.id,
        file_name=document.file_name,
        content_type=content_type,
        content=content,
    )


def update_document(
    db: Session,
    document_id: UUID,
    payload: AnimalDocumentUpdate,
    authenticated_user_id: UUID | None = None,
) -> AnimalDocumentResponse:
    # TODO: enforce organization membership when authenticated user context is wired.
    document = get_document_entity(db, document_id)
    if document.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived documents cannot be updated",
        )
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided",
        )
    if "document_type" in update_data and update_data["document_type"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="documentType cannot be null",
        )

    issued_at = update_data.get("issued_at", document.issued_at)
    expires_at = update_data.get("expires_at", document.expires_at)
    _validate_dates(issued_at, expires_at)
    for field_name, value in update_data.items():
        setattr(document, field_name, value)
    document.updated_at = datetime.utcnow()
    saved = animal_document_repository.save_document(db, document)
    return AnimalDocumentResponse.model_validate(saved)


def archive_document(
    db: Session,
    document_id: UUID,
    authenticated_user_id: UUID | None = None,
) -> AnimalDocumentResponse:
    # TODO: enforce organization membership when authenticated user context is wired.
    document = animal_document_repository.get_document_by_id(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal document not found",
        )
    if document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Soft-deleted documents cannot be archived",
        )
    if document.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already archived",
        )
    document.status = "archived"
    document.updated_at = datetime.utcnow()
    saved = animal_document_repository.save_document(db, document)
    return AnimalDocumentResponse.model_validate(saved)


def delete_document(
    db: Session,
    document_id: UUID,
    authenticated_user_id: UUID | None = None,
) -> None:
    # TODO: enforce organization membership when authenticated user context is wired.
    document = animal_document_repository.get_document_by_id(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal document not found",
        )
    if document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already deleted",
        )
    animal_document_repository.soft_delete_document(db, document)

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict

from schemas.base import APIModel

DocumentType = Literal[
    "identification",
    "pedigree",
    "health_certificate",
    "vaccination_record",
    "transport_permit",
    "ownership_proof",
    "insurance",
    "laboratory_result",
    "other",
]
DocumentStatus = Literal["active", "archived"]


class AnimalDocumentUploadMetadata(APIModel):
    model_config = ConfigDict(extra="forbid")

    document_type: DocumentType
    issued_at: date | None = None
    expires_at: date | None = None


class AnimalDocumentUpdate(APIModel):
    model_config = ConfigDict(extra="forbid")

    document_type: DocumentType | None = None
    issued_at: date | None = None
    expires_at: date | None = None


class AnimalDocumentResponse(APIModel):
    id: UUID
    organization_id: UUID
    animal_id: UUID
    document_type: DocumentType
    file_name: str
    status: DocumentStatus
    issued_at: date | None = None
    expires_at: date | None = None
    uploaded_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

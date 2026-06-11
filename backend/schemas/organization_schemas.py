from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from schemas.base import APIModel


def normalize_portuguese_nif(value: str | None) -> str | None:
    if value is None:
        return None

    digits = "".join(character for character in value if character.isdigit())
    if not digits:
        return None
    return digits


def validate_portuguese_nif(value: str) -> str:
    digits = normalize_portuguese_nif(value)
    if digits is None or len(digits) != 9 or digits[0] not in "1235689":
        raise ValueError("documentNumber must be a valid Portuguese NIF")

    total = sum(
        int(digit) * weight for digit, weight in zip(digits[:8], range(9, 1, -1))
    )
    remainder = total % 11
    check_digit = 0 if remainder < 2 else 11 - remainder

    if check_digit != int(digits[8]):
        raise ValueError("documentNumber must be a valid Portuguese NIF")

    return digits


class OrganizationCreate(APIModel):
    name: str = Field(min_length=1)
    document_number: str = Field(min_length=1)
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None

    @field_validator("document_number")
    @classmethod
    def validate_document_number(cls, value: str) -> str:
        return validate_portuguese_nif(value)


class OrganizationUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1)
    document_number: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None

    @field_validator("document_number")
    @classmethod
    def validate_document_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_portuguese_nif(value)


class OrganizationResponse(APIModel):
    id: UUID
    name: str
    document_number: str
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    created_at: datetime
    updated_at: datetime

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import Species
from repositories import species_repository
from schemas.species_schemas import (
    SpeciesCreate,
    SpeciesResponse,
    SpeciesUpdate,
)


def _normalize_name(value: str) -> str:
    return value.strip().lower()


def create_species(db: Session, payload: SpeciesCreate) -> SpeciesResponse:
    normalized_name = _normalize_name(payload.name)
    existing = species_repository.get_active_species_by_normalized_name(
        db,
        normalized_name,
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Species name already exists",
        )

    species = Species(
        name=payload.name.strip(),
        normalized_name=normalized_name,
    )
    try:
        created = species_repository.create_species(db, species)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Species name already exists",
        ) from exc

    return SpeciesResponse.model_validate(created)


def list_species(
    db: Session,
    search: str | None,
    page: int,
    limit: int,
) -> list[SpeciesResponse]:
    species = species_repository.list_active_species(db, search, page, limit)
    return [SpeciesResponse.model_validate(item) for item in species]


def get_species(db: Session, species_id: UUID) -> SpeciesResponse:
    species = get_species_entity(db, species_id)
    return SpeciesResponse.model_validate(species)


def get_species_entity(db: Session, species_id: UUID) -> Species:
    species = species_repository.get_active_species_by_id(db, species_id)
    if species is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Species not found",
        )
    return species


def update_species(
    db: Session,
    species_id: UUID,
    payload: SpeciesUpdate,
) -> SpeciesResponse:
    species = get_species_entity(db, species_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] is not None:
        normalized_name = _normalize_name(update_data["name"])
        existing = species_repository.get_active_species_by_normalized_name(
            db,
            normalized_name,
        )
        if existing is not None and existing.id != species.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Species name already exists",
            )
        species.name = update_data["name"].strip()
        species.normalized_name = normalized_name

    species.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(species)
    return SpeciesResponse.model_validate(species)


def delete_species(db: Session, species_id: UUID) -> None:
    species = get_species_entity(db, species_id)
    if species_repository.has_active_breeds(db, species.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete species with linked breeds",
        )
    if species_repository.has_active_animals(db, species.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete species with linked animals",
        )

    species.deleted_at = datetime.utcnow()
    species.updated_at = datetime.utcnow()
    db.commit()

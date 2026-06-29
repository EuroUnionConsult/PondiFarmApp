from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import Breed
from repositories import breed_repository
from schemas.breed_schemas import BreedCreate, BreedResponse, BreedUpdate
from services import species_service


def _normalize_name(value: str) -> str:
    return value.strip().lower()


def create_breed(
    db: Session,
    species_id: UUID,
    payload: BreedCreate,
) -> BreedResponse:
    species_service.get_species_entity(db, species_id)
    normalized_name = _normalize_name(payload.name)
    existing = breed_repository.get_active_breed_by_species_and_normalized_name(
        db,
        species_id,
        normalized_name,
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Breed name already exists for this species",
        )

    breed = Breed(
        species_id=species_id,
        name=payload.name.strip(),
        normalized_name=normalized_name,
    )
    try:
        created = breed_repository.create_breed(db, breed)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Breed name already exists for this species",
        ) from exc

    return BreedResponse.model_validate(created)


def list_breeds(
    db: Session,
    species_id: UUID,
    search: str | None,
    page: int,
    limit: int,
) -> list[BreedResponse]:
    species_service.get_species_entity(db, species_id)
    breeds = breed_repository.list_active_breeds_by_species(
        db,
        species_id,
        search,
        page,
        limit,
    )
    return [BreedResponse.model_validate(item) for item in breeds]


def get_breed(db: Session, breed_id: UUID) -> BreedResponse:
    breed = get_breed_entity(db, breed_id)
    return BreedResponse.model_validate(breed)


def get_breed_entity(db: Session, breed_id: UUID) -> Breed:
    breed = breed_repository.get_active_breed_by_id(db, breed_id)
    if breed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Breed not found",
        )
    return breed


def update_breed(db: Session, breed_id: UUID, payload: BreedUpdate) -> BreedResponse:
    breed = get_breed_entity(db, breed_id)
    update_data = payload.model_dump(exclude_unset=True)
    target_species_id = breed.species_id
    normalized_name = breed.normalized_name

    if "species_id" in update_data and update_data["species_id"] is not None:
        species_service.get_species_entity(db, update_data["species_id"])
        target_species_id = update_data["species_id"]

    if "name" in update_data and update_data["name"] is not None:
        normalized_name = _normalize_name(update_data["name"])

    existing = breed_repository.get_active_breed_by_species_and_normalized_name(
        db,
        target_species_id,
        normalized_name,
    )
    if existing is not None and existing.id != breed.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Breed name already exists for this species",
        )

    if "species_id" in update_data and update_data["species_id"] is not None:
        breed.species_id = update_data["species_id"]
    if "name" in update_data and update_data["name"] is not None:
        breed.name = update_data["name"].strip()
        breed.normalized_name = normalized_name

    breed.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(breed)
    return BreedResponse.model_validate(breed)


def delete_breed(db: Session, breed_id: UUID) -> None:
    breed = get_breed_entity(db, breed_id)
    if breed_repository.has_active_animals(db, breed.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete breed with linked animals",
        )

    breed.deleted_at = datetime.utcnow()
    breed.updated_at = datetime.utcnow()
    db.commit()

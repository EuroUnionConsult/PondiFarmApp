from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import Animal
from repositories import animal_repository
from schemas.animal_schemas import (
    AnimalCreate,
    AnimalResponse,
    AnimalUpdate,
)
from services import breed_service, organization_service, species_service


def _normalize_tag_code(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _validate_species_and_breed(
    db: Session,
    species_id: UUID,
    breed_id: UUID,
) -> None:
    species_service.get_species_entity(db, species_id)
    breed = breed_service.get_breed_entity(db, breed_id)
    if breed.species_id != species_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Breed does not belong to the selected species",
        )


def create_animal(db: Session, payload: AnimalCreate) -> AnimalResponse:
    organization_service.get_organization_entity(db, payload.organization_id)
    _validate_species_and_breed(db, payload.species_id, payload.breed_id)

    tag_code = _normalize_tag_code(payload.tag_code)
    if tag_code is not None:
        existing = animal_repository.get_active_animal_by_tag_code(
            db,
            payload.organization_id,
            tag_code,
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Animal tag code already exists in this organization",
            )

    animal = Animal(
        organization_id=payload.organization_id,
        species_id=payload.species_id,
        breed_id=payload.breed_id,
        name=payload.name.strip(),
        tag_code=tag_code,
        sex=payload.sex,
        birth_date=payload.birth_date,
        photo_url=payload.photo_url,
        notes=payload.notes,
    )
    try:
        created = animal_repository.create_animal(db, animal)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Animal tag code already exists in this organization",
        ) from exc

    return AnimalResponse.model_validate(created)


def list_animals(
    db: Session,
    organization_id: UUID,
    search: str | None,
    species_id: UUID | None,
    breed_id: UUID | None,
    sex: str | None,
    page: int,
    limit: int,
) -> list[AnimalResponse]:
    # TODO: enforce organization membership and authorization when auth is available.
    organization_service.get_organization_entity(db, organization_id)
    animals = animal_repository.list_active_animals_by_organization(
        db,
        organization_id,
        search,
        species_id,
        breed_id,
        sex,
        page,
        limit,
    )
    return [AnimalResponse.model_validate(item) for item in animals]


def get_animal(db: Session, animal_id: UUID) -> AnimalResponse:
    animal = get_animal_entity(db, animal_id)
    return AnimalResponse.model_validate(animal)


def get_animal_entity(db: Session, animal_id: UUID) -> Animal:
    animal = animal_repository.get_active_animal_by_id(db, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal not found",
        )
    return animal


def update_animal(
    db: Session, animal_id: UUID, payload: AnimalUpdate
) -> AnimalResponse:
    animal = get_animal_entity(db, animal_id)
    update_data = payload.model_dump(exclude_unset=True)
    target_organization_id = animal.organization_id
    target_species_id = animal.species_id
    target_breed_id = animal.breed_id

    if "organization_id" in update_data and update_data["organization_id"] is not None:
        organization_service.get_organization_entity(db, update_data["organization_id"])
        target_organization_id = update_data["organization_id"]

    if "species_id" in update_data and update_data["species_id"] is not None:
        species_service.get_species_entity(db, update_data["species_id"])
        target_species_id = update_data["species_id"]

    if "breed_id" in update_data and update_data["breed_id"] is not None:
        breed = breed_service.get_breed_entity(db, update_data["breed_id"])
        target_breed_id = update_data["breed_id"]
    else:
        breed = breed_service.get_breed_entity(db, target_breed_id)

    if target_species_id is not None and target_breed_id is not None:
        if breed.species_id != target_species_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Breed does not belong to the selected species",
            )

    if "tag_code" in update_data:
        normalized_tag_code = _normalize_tag_code(update_data["tag_code"])
        if normalized_tag_code is not None:
            existing = animal_repository.get_active_animal_by_tag_code(
                db,
                target_organization_id,
                normalized_tag_code,
            )
            if existing is not None and existing.id != animal.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Animal tag code already exists in this organization",
                )
        animal.tag_code = normalized_tag_code

    if "organization_id" in update_data and update_data["organization_id"] is not None:
        animal.organization_id = update_data["organization_id"]
    if "species_id" in update_data and update_data["species_id"] is not None:
        animal.species_id = update_data["species_id"]
    if "breed_id" in update_data and update_data["breed_id"] is not None:
        animal.breed_id = update_data["breed_id"]
    if "name" in update_data and update_data["name"] is not None:
        animal.name = update_data["name"].strip()
    if "sex" in update_data and update_data["sex"] is not None:
        animal.sex = update_data["sex"]
    if "birth_date" in update_data:
        animal.birth_date = update_data["birth_date"]
    if "photo_url" in update_data:
        animal.photo_url = update_data["photo_url"]
    if "notes" in update_data:
        animal.notes = update_data["notes"]

    animal.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Animal tag code already exists in this organization",
        ) from exc
    db.refresh(animal)
    return AnimalResponse.model_validate(animal)


def delete_animal(db: Session, animal_id: UUID) -> None:
    animal = get_animal_entity(db, animal_id)
    animal.deleted_at = datetime.utcnow()
    animal.updated_at = datetime.utcnow()
    db.commit()

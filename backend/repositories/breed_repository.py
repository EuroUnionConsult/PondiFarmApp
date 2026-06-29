from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from models.models import Animal, Breed


def create_breed(db: Session, breed: Breed) -> Breed:
    db.add(breed)
    db.commit()
    db.refresh(breed)
    return breed


def list_active_breeds_by_species(
    db: Session,
    species_id: UUID,
    search: str | None,
    page: int,
    limit: int,
) -> list[Breed]:
    statement = select(Breed).where(
        Breed.species_id == species_id,
        Breed.deleted_at.is_(None),
    )
    if search:
        search_term = f"%{search.strip().lower()}%"
        statement = statement.where(func.lower(Breed.name).like(search_term))
    statement = statement.order_by(Breed.created_at.asc())
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())


def get_active_breed_by_id(db: Session, breed_id: UUID) -> Breed | None:
    statement = select(Breed).where(
        Breed.id == breed_id,
        Breed.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_active_breed_by_species_and_normalized_name(
    db: Session,
    species_id: UUID,
    normalized_name: str,
) -> Breed | None:
    statement = select(Breed).where(
        Breed.species_id == species_id,
        Breed.normalized_name == normalized_name,
        Breed.deleted_at.is_(None),
    )
    return db.scalar(statement)


def has_active_animals(db: Session, breed_id: UUID) -> bool:
    statement = (
        select(Animal.id)
        .where(
            Animal.breed_id == breed_id,
            Animal.deleted_at.is_(None),
        )
        .limit(1)
    )
    return db.scalar(statement) is not None

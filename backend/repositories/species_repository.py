from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from models.models import Animal, Breed, Species


def create_species(db: Session, species: Species) -> Species:
    db.add(species)
    db.commit()
    db.refresh(species)
    return species


def list_active_species(
    db: Session,
    search: str | None,
    page: int,
    limit: int,
) -> list[Species]:
    statement = select(Species).where(Species.deleted_at.is_(None))
    if search:
        search_term = f"%{search.strip().lower()}%"
        statement = statement.where(func.lower(Species.name).like(search_term))
    statement = statement.order_by(Species.created_at.asc())
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())


def get_active_species_by_id(db: Session, species_id: UUID) -> Species | None:
    statement = select(Species).where(
        Species.id == species_id,
        Species.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_species_by_normalized_name(db: Session, normalized_name: str) -> Species | None:
    statement = select(Species).where(Species.normalized_name == normalized_name)
    return db.scalar(statement)


def get_active_species_by_normalized_name(
    db: Session,
    normalized_name: str,
) -> Species | None:
    statement = select(Species).where(
        Species.normalized_name == normalized_name,
        Species.deleted_at.is_(None),
    )
    return db.scalar(statement)


def has_active_breeds(db: Session, species_id: UUID) -> bool:
    statement = select(Breed.id).where(
        Breed.species_id == species_id,
        Breed.deleted_at.is_(None),
    ).limit(1)
    return db.scalar(statement) is not None


def has_active_animals(db: Session, species_id: UUID) -> bool:
    statement = select(Animal.id).where(
        Animal.species_id == species_id,
        Animal.deleted_at.is_(None),
    ).limit(1)
    return db.scalar(statement) is not None

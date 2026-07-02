from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func

from models.models import Animal


def create_animal(db: Session, animal: Animal) -> Animal:
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return animal


def get_active_animal_by_id(db: Session, animal_id: UUID) -> Animal | None:
    statement = (
        select(Animal)
        .options(
            joinedload(Animal.species),
            joinedload(Animal.breed),
        )
        .where(Animal.id == animal_id, Animal.deleted_at.is_(None))
    )
    return db.scalar(statement)


def get_active_animal_by_tag_code(
    db: Session,
    organization_id: UUID,
    tag_code: str,
) -> Animal | None:
    statement = select(Animal).where(
        Animal.organization_id == organization_id,
        Animal.tag_code == tag_code,
        Animal.deleted_at.is_(None),
    )
    return db.scalar(statement)


def list_active_animals_by_organization(
    db: Session,
    organization_id: UUID,
    search: str | None,
    species_id: UUID | None,
    breed_id: UUID | None,
    sex: str | None,
    page: int,
    limit: int,
) -> list[Animal]:
    statement = (
        select(Animal)
        .options(
            joinedload(Animal.species),
            joinedload(Animal.breed),
        )
        .where(Animal.organization_id == organization_id)
        .where(Animal.deleted_at.is_(None))
    )

    if species_id is not None:
        statement = statement.where(Animal.species_id == species_id)

    if breed_id is not None:
        statement = statement.where(Animal.breed_id == breed_id)

    if sex is not None:
        statement = statement.where(Animal.sex == sex)

    if search:
        search_term = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(Animal.name).like(search_term)
            | func.lower(Animal.tag_code).like(search_term)
        )

    statement = statement.order_by(Animal.created_at.asc())
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())

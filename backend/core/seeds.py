from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import Breed, Species

INITIAL_SPECIES = [
    "Bovine",
    "Ovine",
    "Caprine",
    "Equine",
    "Swine",
]

COMMON_BOVINE_BREEDS = [
    "Angus",
    "Holstein",
    "Nelore",
    "Hereford",
    "Charolais",
    "Limousin",
    "Simmental",
    "Other",
]


def _normalize_name(value: str) -> str:
    return value.strip().lower()


def _ensure_species(session: Session) -> None:
    for name in INITIAL_SPECIES:
        normalized_name = _normalize_name(name)
        statement = select(Species).where(Species.normalized_name == normalized_name)
        if session.scalar(statement) is None:
            session.add(Species(name=name.strip(), normalized_name=normalized_name))


def _ensure_bovine_breeds(session: Session, bovine_id: object) -> None:
    for name in COMMON_BOVINE_BREEDS:
        normalized_name = _normalize_name(name)
        statement = select(Breed).where(
            Breed.species_id == bovine_id,
            Breed.normalized_name == normalized_name,
        )
        if session.scalar(statement) is None:
            session.add(
                Breed(
                    species_id=bovine_id,
                    name=name.strip(),
                    normalized_name=normalized_name,
                ),
            )


def seed_database() -> None:
    from core.database import SessionLocal

    with SessionLocal() as session:
        _ensure_species(session)
        session.commit()
        bovine = session.scalar(select(Species).where(Species.normalized_name == "bovine"))
        if bovine is not None:
            _ensure_bovine_breeds(session, bovine.id)
            session.commit()

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.animal_schemas import (
    AnimalCreate,
    AnimalResponse,
    AnimalUpdate,
)
from services import animal_service

animals_router = APIRouter(prefix="/api/v1", tags=["animals"])


def _ensure_same_org(current: CurrentUser, organization_id: UUID) -> None:
    """Barra acesso a recursos de outra organização (isolamento multi-tenant)."""
    if organization_id != current.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recurso fora da sua organização",
        )


@animals_router.get(
    "/organizations/{organization_id}/animals",
    response_model=list[AnimalResponse],
)
def list_organization_animals(
    organization_id: UUID,
    search: str | None = Query(default=None),
    species_id: UUID | None = Query(default=None, alias="speciesId"),
    breed_id: UUID | None = Query(default=None, alias="breedId"),
    sex: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_same_org(current, organization_id)
    return animal_service.list_animals(
        db,
        organization_id,
        search,
        species_id,
        breed_id,
        sex,
        page,
        limit,
    )


@animals_router.post(
    "/animals",
    response_model=AnimalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_animal(
    payload: AnimalCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    # A org vem SEMPRE do token — o cliente não escolhe em que org cria.
    payload.organization_id = current.organization_id
    return animal_service.create_animal(db, payload)


@animals_router.get("/animals/{animal_id}", response_model=AnimalResponse)
def get_animal(
    animal_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    animal = animal_service.get_animal_entity(db, animal_id)
    _ensure_same_org(current, animal.organization_id)
    return AnimalResponse.model_validate(animal)


@animals_router.patch("/animals/{animal_id}", response_model=AnimalResponse)
def update_animal(
    animal_id: UUID,
    payload: AnimalUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    animal = animal_service.get_animal_entity(db, animal_id)
    _ensure_same_org(current, animal.organization_id)
    # Não permite mover o animal para outra organização.
    if payload.organization_id is not None:
        _ensure_same_org(current, payload.organization_id)
    return animal_service.update_animal(db, animal_id, payload)


@animals_router.delete("/animals/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_animal(
    animal_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    animal = animal_service.get_animal_entity(db, animal_id)
    _ensure_same_org(current, animal.organization_id)
    animal_service.delete_animal(db, animal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

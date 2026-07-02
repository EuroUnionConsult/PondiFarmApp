from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.breed_schemas import BreedCreate, BreedResponse
from schemas.species_schemas import SpeciesCreate, SpeciesResponse, SpeciesUpdate
from services import breed_service, species_service

species_router = APIRouter(prefix="/api/v1/species", tags=["species"])

# Species/breeds são dados de referência GLOBAIS (não por org): leitura exige token
# (fecha o furo público do M3-A), escrita idem — sem role admin ainda, exige auth.


@species_router.get("", response_model=list[SpeciesResponse])
def list_species(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return species_service.list_species(db, search, page, limit)


@species_router.get("/{species_id}", response_model=SpeciesResponse)
def get_species(
    species_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return species_service.get_species(db, species_id)


@species_router.post(
    "", response_model=SpeciesResponse, status_code=status.HTTP_201_CREATED
)
def create_species(
    payload: SpeciesCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return species_service.create_species(db, payload)


@species_router.patch("/{species_id}", response_model=SpeciesResponse)
def update_species(
    species_id: UUID,
    payload: SpeciesUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return species_service.update_species(db, species_id, payload)


@species_router.delete("/{species_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_species(
    species_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    species_service.delete_species(db, species_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@species_router.get("/{species_id}/breeds", response_model=list[BreedResponse])
def list_breeds_by_species(
    species_id: UUID,
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return breed_service.list_breeds(db, species_id, search, page, limit)


@species_router.post(
    "/{species_id}/breeds",
    response_model=BreedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_breed(
    species_id: UUID,
    payload: BreedCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return breed_service.create_breed(db, species_id, payload)

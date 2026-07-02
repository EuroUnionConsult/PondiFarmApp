from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.breed_schemas import BreedResponse, BreedUpdate
from services import breed_service

breeds_router = APIRouter(prefix="/api/v1/breeds", tags=["breeds"])


@breeds_router.get("/{breed_id}", response_model=BreedResponse)
def get_breed(
    breed_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return breed_service.get_breed(db, breed_id)


@breeds_router.patch("/{breed_id}", response_model=BreedResponse)
def update_breed(
    breed_id: UUID,
    payload: BreedUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return breed_service.update_breed(db, breed_id, payload)


@breeds_router.delete("/{breed_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_breed(
    breed_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    breed_service.delete_breed(db, breed_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

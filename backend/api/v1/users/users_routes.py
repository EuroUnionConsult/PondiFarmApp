from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import CurrentUser, get_current_user
from schemas.user_schemas import UserCreate, UserResponse, UserUpdate
from services import user_service

users_router = APIRouter(prefix="/api/v1/users", tags=["users"])

# Sem modelo de admin ainda: um usuário só acessa/edita a PRÓPRIA conta.
# Fecha o IDOR (account takeover / enumeração de PII) sem quebrar o app,
# que não usa estas rotas (cadastro é via /auth/register).


def _ensure_self(current: CurrentUser, user_id: UUID) -> None:
    if user_id != current.user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só é possível acessar a própria conta")


@users_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    return user_service.create_user(db, payload)


@users_router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    # Não enumera todos os usuários — devolve só a própria conta.
    return [user_service.get_user(db, current.user.id)]


@users_router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_self(current, user_id)
    return user_service.get_user(db, user_id)


@users_router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_self(current, user_id)
    return user_service.update_user(db, user_id, payload)


@users_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
):
    _ensure_self(current, user_id)
    user_service.delete_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.security import hash_password
from models.models import User
from repositories import user_repository
from schemas.user_schemas import UserCreate, UserResponse, UserUpdate


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user(db: Session, payload: UserCreate) -> UserResponse:
    normalized_email = _normalize_email(payload.email)
    if user_repository.get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User email already exists",
        )

    user = User(
        name=payload.name,
        email=normalized_email,
        password_hash=hash_password(payload.password),
    )
    try:
        created = user_repository.create_user(db, user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User email already exists",
        ) from exc

    return UserResponse.model_validate(created)


def list_users(db: Session) -> list[UserResponse]:
    users = user_repository.list_active_users(db)
    return [UserResponse.model_validate(item) for item in users]


def get_user(db: Session, user_id: UUID) -> UserResponse:
    user = get_user_entity(db, user_id)
    return UserResponse.model_validate(user)


def get_user_entity(db: Session, user_id: UUID) -> User:
    user = user_repository.get_active_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def update_user(db: Session, user_id: UUID, payload: UserUpdate) -> UserResponse:
    user = get_user_entity(db, user_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"]:
        normalized_email = _normalize_email(update_data["email"])
        existing = user_repository.get_user_by_email(db, normalized_email)
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User email already exists",
            )
        user.email = normalized_email

    if "name" in update_data:
        user.name = update_data["name"]

    if "password" in update_data and update_data["password"]:
        user.password_hash = hash_password(update_data["password"])

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


def delete_user(db: Session, user_id: UUID) -> None:
    user = get_user_entity(db, user_id)
    user_repository.delete_user(db, user)

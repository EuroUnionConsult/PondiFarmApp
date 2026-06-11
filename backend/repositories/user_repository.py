from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import User


def create_user(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_active_users(db: Session) -> list[User]:
    statement = (
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.asc())
    )
    return list(db.scalars(statement).all())


def get_active_user_by_id(db: Session, user_id: UUID) -> User | None:
    statement = select(User).where(User.id == user_id, User.deleted_at.is_(None))
    return db.scalar(statement)


def get_active_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email, User.deleted_at.is_(None))
    return db.scalar(statement)


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return db.scalar(statement)


def delete_user(db: Session, user: User) -> None:
    now = datetime.utcnow()
    user.deleted_at = now
    user.updated_at = now
    db.commit()

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core import security
from core.database import get_db
from core.deps import CurrentUser, get_current_user
from models.models import Organization, OrganizationMember, User
from schemas.auth_schemas import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
)

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@auth_router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    existing = (
        db.query(User)
        .filter(func.lower(User.email) == email, User.deleted_at.is_(None))
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email já registado")

    org = Organization(
        name=payload.organization_name,
        document_number=f"REG-{uuid.uuid4().hex[:16]}",
    )
    db.add(org)
    db.flush()

    user = User(
        name=payload.name,
        email=email,
        password_hash=security.hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    db.add(
        OrganizationMember(organization_id=org.id, user_id=user.id, role="viewer"),
    )
    db.commit()

    token = security.create_access_token(user.id, org.id)
    return TokenResponse(access_token=token)


@auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    user = (
        db.query(User)
        .filter(func.lower(User.email) == email, User.deleted_at.is_(None))
        .first()
    )
    if user is None or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas")

    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
        )
        .first()
    )
    if member is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuário sem organização")

    token = security.create_access_token(user.id, member.organization_id)
    return TokenResponse(access_token=token)


@auth_router.get("/me", response_model=MeResponse)
def me(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    org = db.get(Organization, current.organization_id)
    return MeResponse(
        id=current.user.id,
        name=current.user.name,
        email=current.user.email,
        organization_id=current.organization_id,
        organization_name=org.name if org is not None else "",
    )

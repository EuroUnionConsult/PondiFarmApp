from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core import rate_limit, security
from core.database import get_db
from core.deps import CurrentAccount, get_current_account
from models.models import ROLE_LEADER, Organization, User
from services import organization_access_service
from schemas.auth_schemas import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
)

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _role_label(role: str) -> str:
    return "leader" if role == ROLE_LEADER else "member"


def _token_for(db: Session, user: User) -> TokenResponse:
    """Token com a organização ativa da conta, ou sem organização."""
    member = organization_access_service.active_membership(db, user.id)
    token = security.create_access_token(
        user.id, member.organization_id if member else None
    )
    return TokenResponse(access_token=token)


@auth_router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    # Contra criação de contas em massa por bots: 10 registos por IP por hora.
    rate_limit.hit(f"register:{rate_limit.client_ip(request)}", 10, 3600)
    email = payload.email.lower()
    existing = (
        db.query(User)
        .filter(func.lower(User.email) == email, User.deleted_at.is_(None))
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email já registado")

    user = User(
        name=payload.name,
        email=email,
        password_hash=security.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Apps 0.7.0 e anteriores mandam o nome da organização: cria-a e a conta fica
    # Líder. A app nova regista sem organização e escolhe a seguir.
    if payload.organization_name:
        organization_access_service.create_organization(
            db, user, payload.organization_name
        )
    return _token_for(db, user)


@auth_router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    email = payload.email.lower()
    # Contra adivinhar senhas: 30 tentativas por IP em 5 min e 10 por conta em
    # 15 min (vindas de qualquer IP). Um login certo zera o contador da conta.
    rate_limit.hit(f"login-ip:{rate_limit.client_ip(request)}", 30, 300)
    rate_limit.hit(f"login-email:{email}", 10, 900)
    user = (
        db.query(User)
        .filter(func.lower(User.email) == email, User.deleted_at.is_(None))
        .first()
    )
    if user is None or not security.verify_password(
        payload.password, user.password_hash
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas")
    rate_limit.clear(f"login-email:{email}")
    # Sem organização já não é erro: a conta entra e vê o ecrã de escolha/espera.
    return _token_for(db, user)


@auth_router.post("/token/refresh", response_model=TokenResponse)
def refresh_token(
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Novo token com a organização ATUAL — a app chama-o quando o /me passa de
    `pending` a `active` (pedido aprovado), sem obrigar a novo login."""
    return _token_for(db, account.user)


@auth_router.get("/me", response_model=MeResponse)
def me(
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> MeResponse:
    base = {
        "id": account.user.id,
        "name": account.user.name,
        "email": account.user.email,
    }
    member = organization_access_service.active_membership(db, account.user.id)
    if member is not None:
        org = db.get(Organization, member.organization_id)
        return MeResponse(
            **base,
            membership_status="active",
            role=_role_label(member.role),
            organization_id=member.organization_id,
            organization_name=org.name if org is not None else "",
        )
    req = organization_access_service.pending_request(db, account.user.id)
    if req is not None:
        org = db.get(Organization, req.organization_id)
        return MeResponse(
            **base,
            membership_status="pending",
            pending_organization_id=req.organization_id,
            pending_organization_name=org.name if org is not None else "",
        )
    return MeResponse(**base, membership_status="none")

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core import security
from core.database import get_db
from models.models import ROLE_LEADER, Organization, OrganizationMember, User

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentAccount:
    """Qualquer token válido, com ou sem organização."""

    user: User
    token_organization_id: UUID | None


@dataclass
class CurrentUser:
    """Membro ATIVO da organização do token. `role` vem da base de dados em cada
    pedido, não do token: remover alguém ou mudar-lhe o papel tem efeito logo,
    em vez de só quando o token (7 dias) expirar."""

    user: User
    organization_id: UUID
    role: str

    @property
    def is_leader(self) -> bool:
        return self.role == ROLE_LEADER


def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentAccount:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    try:
        payload = security.decode_token(credentials.credentials)
        user_id = UUID(payload["sub"])
        raw_org = payload.get("org") or ""
        organization_id = UUID(raw_org) if raw_org else None
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")

    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário inválido")
    return CurrentAccount(user=user, token_organization_id=organization_id)


def get_current_user(
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if account.token_organization_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem organização ativa")
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == account.user.id,
            OrganizationMember.organization_id == account.token_organization_id,
            OrganizationMember.deleted_at.is_(None),
        )
        .first()
    )
    if member is None:
        # Foi removido depois de o token ser emitido.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Já não é membro desta organização"
        )
    org = db.get(Organization, account.token_organization_id)
    if org is None or org.deleted_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organização arquivada")
    return CurrentUser(
        user=account.user,
        organization_id=account.token_organization_id,
        role=member.role,
    )


def require_leader(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current.is_leader:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Só o líder da organização pode fazer isto"
        )
    return current

"""Organizações com Líder: criar, pesquisar, pedir entrada, aprovar, remover,
passar a liderança e sair.

Regras (plano de 21/10/2026, vault `pondifarm_plano_organizacoes_2026-10-21.md`):
- Papéis: `owner` = Líder (sempre exatamente 1), `viewer` = Membro.
- Quem pede entrada fica em `organization_join_requests`, nunca em
  `organization_members`: um pendente não tem acesso a dados.
- Uma conta pertence a uma só organização ativa de cada vez.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.models import (
    JOIN_APPROVED,
    JOIN_CANCELLED,
    JOIN_PENDING,
    JOIN_REJECTED,
    ROLE_LEADER,
    ROLE_MEMBER,
    Organization,
    OrganizationJoinRequest,
    OrganizationMember,
    User,
)

SEARCH_MIN_CHARS = 3
SEARCH_LIMIT = 10


def _conflict(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, msg)


def _not_found(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, msg)


def _live_org(db: Session, organization_id: uuid.UUID) -> Organization:
    org = db.get(Organization, organization_id)
    if org is None or org.deleted_at is not None:
        raise _not_found("Organização não encontrada")
    return org


def active_membership(db: Session, user_id: uuid.UUID) -> OrganizationMember | None:
    """A organização ativa da conta (não removida, organização não arquivada)."""
    return (
        db.query(OrganizationMember)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.deleted_at.is_(None),
            Organization.deleted_at.is_(None),
        )
        .order_by(OrganizationMember.created_at)
        .first()
    )


def pending_request(db: Session, user_id: uuid.UUID) -> OrganizationJoinRequest | None:
    return (
        db.query(OrganizationJoinRequest)
        .filter(
            OrganizationJoinRequest.user_id == user_id,
            OrganizationJoinRequest.status == JOIN_PENDING,
        )
        .first()
    )


def _require_no_organization(db: Session, user_id: uuid.UUID) -> None:
    if active_membership(db, user_id) is not None:
        raise _conflict("Já pertence a uma organização")


def _member_row(
    db: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> OrganizationMember | None:
    """A linha (ativa ou removida) — a tabela tem UNIQUE(organization_id, user_id)."""
    return (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        .first()
    )


def create_organization(db: Session, user: User, name: str) -> Organization:
    _require_no_organization(db, user.id)
    if pending_request(db, user.id) is not None:
        raise _conflict("Tem um pedido de entrada pendente; cancele-o primeiro")
    org = Organization(
        name=name.strip(), document_number=f"REG-{uuid.uuid4().hex[:16]}"
    )
    db.add(org)
    db.flush()
    db.add(
        OrganizationMember(organization_id=org.id, user_id=user.id, role=ROLE_LEADER)
    )
    db.commit()
    db.refresh(org)
    return org


def search_organizations(db: Session, query: str) -> list[Organization]:
    q = (query or "").strip()
    if len(q) < SEARCH_MIN_CHARS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Escreva pelo menos {SEARCH_MIN_CHARS} letras",
        )
    # Só o nome sai daqui (o router não expõe mais nada). Escapar os curingas do LIKE.
    escaped = q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return (
        db.query(Organization)
        .filter(
            Organization.deleted_at.is_(None),
            func.lower(Organization.name).like(f"%{escaped}%", escape="\\"),
        )
        .order_by(Organization.name)
        .limit(SEARCH_LIMIT)
        .all()
    )


def request_to_join(
    db: Session, user: User, organization_id: uuid.UUID
) -> OrganizationJoinRequest:
    _live_org(db, organization_id)
    _require_no_organization(db, user.id)
    if pending_request(db, user.id) is not None:
        raise _conflict("Já tem um pedido de entrada pendente")
    req = OrganizationJoinRequest(
        organization_id=organization_id, user_id=user.id, status=JOIN_PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def cancel_my_request(db: Session, user: User) -> None:
    req = pending_request(db, user.id)
    if req is None:
        raise _not_found("Não há pedido pendente")
    req.status = JOIN_CANCELLED
    req.decided_at = datetime.utcnow()
    req.decided_by_user_id = user.id
    db.commit()


def list_pending_requests(
    db: Session, organization_id: uuid.UUID
) -> list[tuple[OrganizationJoinRequest, User]]:
    return (
        db.query(OrganizationJoinRequest, User)
        .join(User, User.id == OrganizationJoinRequest.user_id)
        .filter(
            OrganizationJoinRequest.organization_id == organization_id,
            OrganizationJoinRequest.status == JOIN_PENDING,
            User.deleted_at.is_(None),
        )
        .order_by(OrganizationJoinRequest.created_at)
        .all()
    )


def decide_request(
    db: Session,
    leader: User,
    organization_id: uuid.UUID,
    request_id: uuid.UUID,
    approve: bool,
) -> OrganizationJoinRequest:
    req = db.get(OrganizationJoinRequest, request_id)
    if (
        req is None
        or req.organization_id != organization_id
        or req.status != JOIN_PENDING
    ):
        raise _not_found("Pedido não encontrado")
    if approve:
        # Pode ter entrado noutra organização entretanto.
        if active_membership(db, req.user_id) is not None:
            req.status = JOIN_CANCELLED
            req.decided_at = datetime.utcnow()
            req.decided_by_user_id = leader.id
            db.commit()
            raise _conflict("Essa pessoa já pertence a outra organização")
        row = _member_row(db, organization_id, req.user_id)
        if row is None:
            db.add(
                OrganizationMember(
                    organization_id=organization_id,
                    user_id=req.user_id,
                    role=ROLE_MEMBER,
                )
            )
        else:  # já foi membro e saiu/foi removido: reativa a mesma linha
            row.deleted_at = None
            row.role = ROLE_MEMBER
    req.status = JOIN_APPROVED if approve else JOIN_REJECTED
    req.decided_at = datetime.utcnow()
    req.decided_by_user_id = leader.id
    db.commit()
    db.refresh(req)
    return req


def list_members(
    db: Session, organization_id: uuid.UUID
) -> list[tuple[OrganizationMember, User]]:
    return (
        db.query(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
        .order_by(OrganizationMember.created_at)
        .all()
    )


def _active_member(
    db: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> OrganizationMember:
    row = _member_row(db, organization_id, user_id)
    if row is None or row.deleted_at is not None:
        raise _not_found("Membro não encontrado")
    return row


def remove_member(
    db: Session, leader: User, organization_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    if user_id == leader.id:
        raise _conflict("O líder não se pode remover; passe primeiro a liderança")
    row = _active_member(db, organization_id, user_id)
    row.deleted_at = datetime.utcnow()
    db.commit()


def transfer_leadership(
    db: Session, leader: User, organization_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    if user_id == leader.id:
        raise _conflict("Já é o líder")
    target = _active_member(db, organization_id, user_id)
    current = _active_member(db, organization_id, leader.id)
    # Ordem importa: o índice único deixa haver só 1 owner ativo. Primeiro o líder
    # atual desce, depois o novo sobe — tudo na mesma transação.
    current.role = ROLE_MEMBER
    db.flush()
    target.role = ROLE_LEADER
    db.commit()


def leave_organization(db: Session, user: User, organization_id: uuid.UUID) -> None:
    row = _active_member(db, organization_id, user.id)
    if row.role == ROLE_LEADER:
        raise _conflict("O líder não pode sair; passe primeiro a liderança")
    row.deleted_at = datetime.utcnow()
    db.commit()

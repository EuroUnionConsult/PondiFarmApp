from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from models.models import OrganizationMember, User


def create_member(db: Session, member: OrganizationMember) -> OrganizationMember:
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def list_active_members_by_organization(
    db: Session,
    organization_id: UUID,
) -> list[OrganizationMember]:
    statement = (
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.user))
        .where(OrganizationMember.organization_id == organization_id)
        .where(OrganizationMember.deleted_at.is_(None))
        .join(User, OrganizationMember.user_id == User.id)
        .where(User.deleted_at.is_(None))
        .order_by(OrganizationMember.created_at.asc())
    )
    return list(db.scalars(statement).all())


def get_active_member_by_id(
    db: Session,
    organization_id: UUID,
    member_id: UUID,
) -> OrganizationMember | None:
    statement = (
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.user))
        .where(OrganizationMember.organization_id == organization_id)
        .where(OrganizationMember.id == member_id)
        .where(OrganizationMember.deleted_at.is_(None))
        .join(User, OrganizationMember.user_id == User.id)
        .where(User.deleted_at.is_(None))
    )
    return db.scalar(statement)


def get_active_member_by_organization_and_user(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
) -> OrganizationMember | None:
    statement = select(OrganizationMember).where(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.deleted_at.is_(None),
    )
    return db.scalar(statement)


def get_member_by_organization_and_user(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
) -> OrganizationMember | None:
    statement = (
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.user))
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
    )
    return db.scalar(statement)


def delete_member(db: Session, member: OrganizationMember) -> None:
    now = datetime.utcnow()
    member.deleted_at = now
    member.updated_at = now
    db.commit()

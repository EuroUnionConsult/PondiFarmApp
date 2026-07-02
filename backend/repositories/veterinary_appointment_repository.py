from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.models import VeterinaryAppointment


def create_appointment(
    db: Session,
    appointment: VeterinaryAppointment,
) -> VeterinaryAppointment:
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def get_active_appointment_by_id(
    db: Session,
    appointment_id: UUID,
) -> VeterinaryAppointment | None:
    statement = select(VeterinaryAppointment).where(
        VeterinaryAppointment.id == appointment_id,
        VeterinaryAppointment.deleted_at.is_(None),
    )
    return db.scalar(statement)


def list_scheduled_duplicate_candidates(
    db: Session,
    animal_id: UUID,
    scheduled_at: datetime,
    exclude_appointment_id: UUID | None = None,
) -> list[VeterinaryAppointment]:
    statement = select(VeterinaryAppointment).where(
        VeterinaryAppointment.animal_id == animal_id,
        VeterinaryAppointment.scheduled_at == scheduled_at,
        VeterinaryAppointment.status == "scheduled",
        VeterinaryAppointment.deleted_at.is_(None),
    )
    if exclude_appointment_id is not None:
        statement = statement.where(
            VeterinaryAppointment.id != exclude_appointment_id,
        )
    return list(db.scalars(statement).all())


def list_active_appointments(
    db: Session,
    organization_id: UUID | None,
    animal_id: UUID | None,
    appointment_status: str | None,
    scheduled_from: datetime | None,
    scheduled_to_exclusive: datetime | None,
    upcoming_only: bool,
    page: int,
    limit: int,
) -> list[VeterinaryAppointment]:
    statement = select(VeterinaryAppointment).where(
        VeterinaryAppointment.deleted_at.is_(None),
    )

    if organization_id is not None:
        statement = statement.where(
            VeterinaryAppointment.organization_id == organization_id,
        )
    if animal_id is not None:
        statement = statement.where(VeterinaryAppointment.animal_id == animal_id)
    if appointment_status is not None:
        statement = statement.where(
            VeterinaryAppointment.status == appointment_status,
        )
    if scheduled_from is not None:
        statement = statement.where(
            VeterinaryAppointment.scheduled_at >= scheduled_from,
        )
    if scheduled_to_exclusive is not None:
        statement = statement.where(
            VeterinaryAppointment.scheduled_at < scheduled_to_exclusive,
        )
    if upcoming_only:
        statement = statement.where(
            VeterinaryAppointment.status == "scheduled",
            VeterinaryAppointment.scheduled_at >= datetime.utcnow(),
        )

    statement = statement.order_by(
        VeterinaryAppointment.scheduled_at.asc(),
        VeterinaryAppointment.created_at.asc(),
    )
    statement = statement.offset((page - 1) * limit).limit(limit)
    return list(db.scalars(statement).all())


def save_appointment(
    db: Session,
    appointment: VeterinaryAppointment,
) -> VeterinaryAppointment:
    db.commit()
    db.refresh(appointment)
    return appointment


def soft_delete_appointment(
    db: Session,
    appointment: VeterinaryAppointment,
) -> None:
    now = datetime.utcnow()
    appointment.deleted_at = now
    appointment.updated_at = now
    db.commit()

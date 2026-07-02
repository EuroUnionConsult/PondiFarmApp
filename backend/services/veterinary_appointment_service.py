from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.models import VeterinaryAppointment
from repositories import veterinary_appointment_repository
from schemas.veterinary_appointment_schemas import (
    AppointmentStatus,
    VeterinaryAppointmentAction,
    VeterinaryAppointmentCreate,
    VeterinaryAppointmentResponse,
    VeterinaryAppointmentUpdate,
    build_end_of_day_exclusive,
    build_start_of_day,
)
from services import animal_service, organization_service, user_service


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _normalize_title(value: str) -> str:
    return " ".join(value.split()).casefold()


def _ensure_no_scheduled_duplicate(
    db: Session,
    animal_id: UUID,
    scheduled_at: datetime,
    title: str,
    exclude_appointment_id: UUID | None = None,
) -> None:
    candidates = veterinary_appointment_repository.list_scheduled_duplicate_candidates(
        db,
        animal_id,
        scheduled_at,
        exclude_appointment_id,
    )
    normalized_title = _normalize_title(title)
    if any(
        _normalize_title(candidate.title) == normalized_title
        for candidate in candidates
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An identical scheduled veterinary appointment already exists",
        )


def _validate_user(db: Session, user_id: UUID | None) -> None:
    if user_id is not None:
        user_service.get_user_entity(db, user_id)


def create_appointment(
    db: Session,
    animal_id: UUID,
    payload: VeterinaryAppointmentCreate,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    animal = animal_service.get_animal_entity(db, animal_id)
    _validate_user(db, payload.user_id)
    scheduled_at = _normalize_datetime(payload.scheduled_at)

    if scheduled_at < datetime.utcnow():
        if payload.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Past appointments must be created with completed status",
            )
        appointment_status: AppointmentStatus = "completed"
    else:
        if payload.status not in (None, "scheduled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Future appointments must be created with scheduled status",
            )
        appointment_status = "scheduled"

    if appointment_status == "scheduled":
        _ensure_no_scheduled_duplicate(
            db,
            animal.id,
            scheduled_at,
            payload.title,
        )

    appointment = VeterinaryAppointment(
        organization_id=animal.organization_id,
        animal_id=animal.id,
        user_id=payload.user_id,
        title=payload.title,
        scheduled_at=scheduled_at,
        status=appointment_status,
        notes=payload.notes,
        calendar_event_id=payload.calendar_event_id,
    )
    created = veterinary_appointment_repository.create_appointment(db, appointment)
    return VeterinaryAppointmentResponse.model_validate(created)


def list_appointments_for_animal(
    db: Session,
    animal_id: UUID,
    appointment_status: AppointmentStatus | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    limit: int,
) -> list[VeterinaryAppointmentResponse]:
    # TODO: enforce organization membership and authorization when auth is available.
    animal_service.get_animal_entity(db, animal_id)
    _validate_date_range(date_from, date_to)
    appointments = veterinary_appointment_repository.list_active_appointments(
        db,
        None,
        animal_id,
        appointment_status,
        build_start_of_day(date_from) if date_from is not None else None,
        build_end_of_day_exclusive(date_to) if date_to is not None else None,
        False,
        page,
        limit,
    )
    return [VeterinaryAppointmentResponse.model_validate(item) for item in appointments]


def list_appointments_for_organization(
    db: Session,
    organization_id: UUID,
    animal_id: UUID | None,
    appointment_status: AppointmentStatus | None,
    date_from: date | None,
    date_to: date | None,
    upcoming_only: bool,
    page: int,
    limit: int,
) -> list[VeterinaryAppointmentResponse]:
    # TODO: enforce organization membership and authorization when auth is available.
    organization_service.get_organization_entity(db, organization_id)
    _validate_date_range(date_from, date_to)
    if animal_id is not None:
        animal = animal_service.get_animal_entity(db, animal_id)
        if animal.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Animal not found in organization",
            )

    appointments = veterinary_appointment_repository.list_active_appointments(
        db,
        organization_id,
        animal_id,
        appointment_status,
        build_start_of_day(date_from) if date_from is not None else None,
        build_end_of_day_exclusive(date_to) if date_to is not None else None,
        upcoming_only,
        page,
        limit,
    )
    return [VeterinaryAppointmentResponse.model_validate(item) for item in appointments]


def _validate_date_range(date_from: date | None, date_to: date | None) -> None:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dateFrom cannot be after dateTo",
        )


def get_appointment_entity(
    db: Session,
    appointment_id: UUID,
) -> VeterinaryAppointment:
    appointment = veterinary_appointment_repository.get_active_appointment_by_id(
        db,
        appointment_id,
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veterinary appointment not found",
        )
    return appointment


def get_appointment(
    db: Session,
    appointment_id: UUID,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    return VeterinaryAppointmentResponse.model_validate(
        get_appointment_entity(db, appointment_id),
    )


def update_appointment(
    db: Session,
    appointment_id: UUID,
    payload: VeterinaryAppointmentUpdate,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    appointment = get_appointment_entity(db, appointment_id)
    if appointment.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only scheduled appointments can be updated",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided",
        )
    for field_name in ("title", "scheduled_at", "status"):
        if field_name in update_data and update_data[field_name] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="title, scheduledAt, and status cannot be null",
            )

    requested_status = update_data.pop("status", None)
    if requested_status is not None:
        if requested_status != "missed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PATCH only supports the scheduled to missed transition",
            )
        appointment.status = "missed"

    if "user_id" in update_data:
        _validate_user(db, update_data["user_id"])
    if "scheduled_at" in update_data:
        update_data["scheduled_at"] = _normalize_datetime(
            update_data["scheduled_at"],
        )

    effective_scheduled_at = update_data.get(
        "scheduled_at",
        appointment.scheduled_at,
    )
    effective_title = update_data.get("title", appointment.title)
    if appointment.status == "scheduled":
        _ensure_no_scheduled_duplicate(
            db,
            appointment.animal_id,
            effective_scheduled_at,
            effective_title,
            appointment.id,
        )

    for field_name, value in update_data.items():
        setattr(appointment, field_name, value)
    appointment.updated_at = datetime.utcnow()
    saved = veterinary_appointment_repository.save_appointment(db, appointment)
    return VeterinaryAppointmentResponse.model_validate(saved)


def complete_appointment(
    db: Session,
    appointment_id: UUID,
    payload: VeterinaryAppointmentAction,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    appointment = get_appointment_entity(db, appointment_id)
    if appointment.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only scheduled appointments can be completed",
        )
    appointment.status = "completed"
    if payload.notes is not None:
        appointment.notes = payload.notes
    appointment.updated_at = datetime.utcnow()
    saved = veterinary_appointment_repository.save_appointment(db, appointment)
    return VeterinaryAppointmentResponse.model_validate(saved)


def cancel_appointment(
    db: Session,
    appointment_id: UUID,
    payload: VeterinaryAppointmentAction,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    appointment = get_appointment_entity(db, appointment_id)
    if appointment.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only scheduled appointments can be cancelled",
        )
    appointment.status = "cancelled"
    if payload.notes is not None:
        appointment.notes = payload.notes
    appointment.updated_at = datetime.utcnow()
    saved = veterinary_appointment_repository.save_appointment(db, appointment)
    return VeterinaryAppointmentResponse.model_validate(saved)


def archive_appointment(
    db: Session,
    appointment_id: UUID,
) -> VeterinaryAppointmentResponse:
    # TODO: enforce organization membership and authorization when auth is available.
    appointment = get_appointment_entity(db, appointment_id)
    if appointment.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived appointments cannot transition to another status",
        )
    appointment.status = "archived"
    appointment.updated_at = datetime.utcnow()
    saved = veterinary_appointment_repository.save_appointment(db, appointment)
    return VeterinaryAppointmentResponse.model_validate(saved)


def delete_appointment(db: Session, appointment_id: UUID) -> None:
    # TODO: enforce organization membership and authorization when auth is available.
    appointment = get_appointment_entity(db, appointment_id)
    if appointment.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Completed veterinary appointments cannot be deleted",
        )
    if (
        appointment.status != "scheduled"
        or appointment.scheduled_at <= datetime.utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only future scheduled appointments can be deleted",
        )
    veterinary_appointment_repository.soft_delete_appointment(db, appointment)

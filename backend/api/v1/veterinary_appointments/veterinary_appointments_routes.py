from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.veterinary_appointment_schemas import (
    AppointmentStatus,
    VeterinaryAppointmentAction,
    VeterinaryAppointmentCreate,
    VeterinaryAppointmentResponse,
    VeterinaryAppointmentUpdate,
)
from services import veterinary_appointment_service

veterinary_appointments_router = APIRouter(
    prefix="/api/v1",
    tags=["veterinary-appointments"],
)


@veterinary_appointments_router.post(
    "/animals/{animal_id}/veterinary-appointments",
    response_model=VeterinaryAppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_veterinary_appointment(
    animal_id: UUID,
    payload: VeterinaryAppointmentCreate,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.create_appointment(db, animal_id, payload)


@veterinary_appointments_router.get(
    "/animals/{animal_id}/veterinary-appointments",
    response_model=list[VeterinaryAppointmentResponse],
)
def list_animal_veterinary_appointments(
    animal_id: UUID,
    appointment_status: AppointmentStatus | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None, alias="dateFrom"),
    date_to: date | None = Query(default=None, alias="dateTo"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.list_appointments_for_animal(
        db,
        animal_id,
        appointment_status,
        date_from,
        date_to,
        page,
        limit,
    )


@veterinary_appointments_router.get(
    "/organizations/{organization_id}/veterinary-appointments",
    response_model=list[VeterinaryAppointmentResponse],
)
def list_organization_veterinary_appointments(
    organization_id: UUID,
    animal_id: UUID | None = Query(default=None, alias="animalId"),
    appointment_status: AppointmentStatus | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None, alias="dateFrom"),
    date_to: date | None = Query(default=None, alias="dateTo"),
    upcoming_only: bool = Query(default=False, alias="upcomingOnly"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.list_appointments_for_organization(
        db,
        organization_id,
        animal_id,
        appointment_status,
        date_from,
        date_to,
        upcoming_only,
        page,
        limit,
    )


@veterinary_appointments_router.get(
    "/veterinary-appointments/{appointment_id}",
    response_model=VeterinaryAppointmentResponse,
)
def get_veterinary_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.get_appointment(db, appointment_id)


@veterinary_appointments_router.patch(
    "/veterinary-appointments/{appointment_id}",
    response_model=VeterinaryAppointmentResponse,
)
def update_veterinary_appointment(
    appointment_id: UUID,
    payload: VeterinaryAppointmentUpdate,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.update_appointment(
        db,
        appointment_id,
        payload,
    )


@veterinary_appointments_router.post(
    "/veterinary-appointments/{appointment_id}/complete",
    response_model=VeterinaryAppointmentResponse,
)
def complete_veterinary_appointment(
    appointment_id: UUID,
    payload: VeterinaryAppointmentAction,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.complete_appointment(
        db,
        appointment_id,
        payload,
    )


@veterinary_appointments_router.post(
    "/veterinary-appointments/{appointment_id}/cancel",
    response_model=VeterinaryAppointmentResponse,
)
def cancel_veterinary_appointment(
    appointment_id: UUID,
    payload: VeterinaryAppointmentAction,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.cancel_appointment(
        db,
        appointment_id,
        payload,
    )


@veterinary_appointments_router.post(
    "/veterinary-appointments/{appointment_id}/archive",
    response_model=VeterinaryAppointmentResponse,
)
def archive_veterinary_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
):
    return veterinary_appointment_service.archive_appointment(db, appointment_id)


@veterinary_appointments_router.delete(
    "/veterinary-appointments/{appointment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_veterinary_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
):
    veterinary_appointment_service.delete_appointment(db, appointment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

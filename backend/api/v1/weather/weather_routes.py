"""Tempo e bem-estar da quinta (ver services/weather_service.py)."""

from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import (
    CurrentAccount,
    CurrentUser,
    get_current_account,
    get_current_user,
    require_leader,
)
from models.models import Organization
from schemas.base import APIModel
from services import weather_service as wx

weather_router = APIRouter(prefix="/api/v1", tags=["weather"])


class FarmLocationRequest(APIModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    label: str | None = Field(default=None, max_length=255)


class FarmLocationResponse(APIModel):
    lat: float
    lon: float
    label: str | None = None


def _own_org(current: CurrentUser, organization_id: UUID) -> None:
    if current.organization_id != organization_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Recurso fora da sua organização"
        )


def _upstream(e: Exception) -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Weather service unavailable, try again shortly",
    )


@weather_router.get("/organizations/{organization_id}/weather")
def get_weather(
    organization_id: UUID,
    replay: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Previsão, THI e avisos da quinta. Sem localização marcada: `location: null`."""
    _own_org(current, organization_id)
    org = db.get(Organization, organization_id)
    if org is None or org.farm_lat is None or org.farm_lon is None:
        return {"location": None, "canSetLocation": current.is_leader}
    try:
        data = wx.forecast_for(org.farm_lat, org.farm_lon, org.farm_label, replay)
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise _upstream(e) from e
    data["canSetLocation"] = current.is_leader
    return data


@weather_router.put(
    "/organizations/{organization_id}/farm-location",
    response_model=FarmLocationResponse,
)
def set_farm_location(
    organization_id: UUID,
    payload: FarmLocationRequest,
    leader: CurrentUser = Depends(require_leader),
    db: Session = Depends(get_db),
):
    """Só o Líder marca onde fica a quinta. Guarda-se arredondado a ~1 km."""
    _own_org(leader, organization_id)
    org = db.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organização não encontrada")
    org.farm_lat, org.farm_lon = (
        wx.round_coord(payload.lat),
        wx.round_coord(payload.lon),
    )
    org.farm_label = (payload.label or "").strip() or wx.place_name(
        org.farm_lat, org.farm_lon
    )
    db.commit()
    return FarmLocationResponse(
        lat=org.farm_lat, lon=org.farm_lon, label=org.farm_label
    )


@weather_router.get("/places/search")
def search_places(
    q: str = Query(min_length=3, max_length=120),
    account: CurrentAccount = Depends(get_current_account),
):
    """Lugar por nome ou código postal (PT), para marcar a quinta."""
    try:
        return wx.search_places(q)
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise _upstream(e) from e


@weather_router.get("/places/reverse")
def reverse_place(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    account: CurrentAccount = Depends(get_current_account),
):
    """Nome do lugar para um ponto do mapa ou do GPS."""
    return {
        "label": wx.place_name(lat, lon),
        "lat": wx.round_coord(lat),
        "lon": wx.round_coord(lon),
    }

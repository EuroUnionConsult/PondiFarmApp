"""Erros reportados pelas apps (iPhone, web desktop, web mobile).

Sem SaaS externo: cada relatório vira uma linha de log estruturada (`pondifarm.client`),
que vai para o stdout do App Service e, quando ligado, para o Application Insights.
Não há tabela: os logs chegam para saber que erros os utilizadores estão a ter.

Autenticação opcional: com um token válido regista-se o id do utilizador e da
organização (nunca o email). Limite por IP, corpo limitado a 8 KB.
"""

from __future__ import annotations

import logging
from typing import Literal

import jwt
from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import Field, ValidationError

from core import rate_limit, security
from schemas.base import APIModel

client_errors_router = APIRouter(prefix="/api/v1", tags=["client-errors"])
log = logging.getLogger("pondifarm.client")

MAX_BODY = 8 * 1024
RATE_LIMIT = 60  # relatórios por IP
RATE_WINDOW = 300  # em 5 minutos


class ClientErrorReport(APIModel):
    platform: Literal["ios", "web-desktop", "web-mobile"]
    app_version: str = Field(max_length=32)
    screen: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=1000)
    kind: str | None = Field(default=None, max_length=32)
    http_status: int | None = Field(default=None, ge=0, le=599)
    endpoint: str | None = Field(default=None, max_length=200)
    timestamp: str | None = Field(default=None, max_length=40)


def _identity(request: Request) -> tuple[str | None, str | None]:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None, None
    try:
        payload = security.decode_token(auth[7:].strip())
    except jwt.PyJWTError:
        return "invalid-token", None
    return str(payload.get("sub") or "") or None, str(payload.get("org") or "") or None


@client_errors_router.post("/client-errors", status_code=status.HTTP_204_NO_CONTENT)
async def report_client_error(request: Request) -> Response:
    """Regista um erro visto numa app. Responde 204 e nunca devolve dados."""
    rate_limit.hit(
        f"client-errors:{rate_limit.client_ip(request)}", RATE_LIMIT, RATE_WINDOW
    )
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Report too large"
        )
    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_BODY:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Report too large"
            )
    try:
        report = ClientErrorReport.model_validate_json(body or b"{}")
    except ValidationError as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            [{"loc": err["loc"], "msg": err["msg"]} for err in e.errors()],
        ) from None
    user_id, org_id = _identity(request)
    # O endpoint vem sem query string: pesquisas e coordenadas não entram no log.
    endpoint = (report.endpoint or "").split("?", 1)[0] or None
    log.warning(
        "client error",
        extra={
            "platform": report.platform,
            "appVersion": report.app_version,
            "screen": report.screen,
            "kind": report.kind,
            "httpStatus": report.http_status,
            "endpoint": endpoint,
            "clientTimestamp": report.timestamp,
            "clientMessage": report.message,
            "userId": user_id,
            "orgId": org_id,
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

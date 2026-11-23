from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES, GZipMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.v1.organization_access.organization_access_routes import (
    organization_access_router,
)
from api.v1.organizations.organizations_routes import organizations_router
from api.v1.species.species_routes import species_router
from api.v1.breeds.breeds_routes import breeds_router
from api.v1.animals.animals_routes import animals_router
from api.v1.animal_documents.animal_documents_routes import animal_documents_router
from api.v1.scans.scans_routes import scans_router
from api.v1.veterinary_appointments.veterinary_appointments_routes import (
    veterinary_appointments_router,
)
from api.v1.users.users_routes import users_router
from api.v1.organizations_members.organizations_members_routes import (
    organizations_member_router,
)
from api.v1.predictions.prediction_routes import predictions_router
from api.v1.auth.auth_routes import auth_router
from api.v1.weather.weather_routes import weather_router
from api.v1.client_errors.client_errors_routes import client_errors_router
from core.database import get_db, initialize_database
from core.errors import register_exception_handlers
from core.observability import configure_logging, configure_telemetry

_telemetry_on = False

# Formatos que já vêm comprimidos: gzip só gastava CPU (documentos dos animais).
GZIP_EXCLUDED_CONTENT_TYPES = DEFAULT_EXCLUDED_CONTENT_TYPES + (
    "application/pdf",
    "image/heic",
    "image/heif",
)


def create_app() -> FastAPI:
    import os

    global _telemetry_on
    # Logs no stdout (App Service) e, com APPLICATIONINSIGHTS_CONNECTION_STRING,
    # no Application Insights. Tem de vir ANTES de FastAPI(): o Azure Monitor
    # instrumenta a classe FastAPI quando é ligado.
    configure_logging()
    if not _telemetry_on:
        _telemetry_on = configure_telemetry()

    # /docs, /redoc e /openapi.json desligados por defeito: o repositório é público
    # e o mapa da API não precisa de estar exposto em produção. Para desenvolver,
    # API_DOCS_ENABLED=1.
    docs = os.getenv("API_DOCS_ENABLED", "0") == "1"
    app = FastAPI(
        title="PondiFarm API",
        version="0.1.0",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    # CORS configurável por env (D.6): restringir em produção via CORS_ORIGINS
    # (lista separada por vírgula). O app nativo não usa CORS; a versão web
    # (pondifarmdesk) precisa de estar na lista.

    cors_origins = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        # O site lê o formato do modelo 3D neste cabeçalho (GET /scans/{id}/mesh).
        expose_headers=["X-Mesh-Format"],
    )
    # Respostas grandes vão comprimidas (o rebanho em JSON tem ~100 KB e cai para
    # ~10 KB; os modelos PLY/OBJ também encolhem). Abaixo de 1 KB não compensa.
    # Imagens, PDF e ZIP já vêm comprimidos: passam como estão.
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1024,
        compresslevel=6,
        exclude_content_types=GZIP_EXCLUDED_CONTENT_TYPES,
    )

    register_exception_handlers(app)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        # A API só devolve JSON; o Swagger (quando ligado) precisa de carregar scripts.
        if not request.url.path.startswith(("/docs", "/redoc")):
            h.setdefault(
                "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
            )
        if request.url.path.startswith("/api/"):
            h.setdefault("Cache-Control", "no-store")
        return response

    @app.on_event("startup")
    def startup_event():
        initialize_database()

    @app.get("/")
    def health():
        return {"status": "ok", "service": "PondiFarm API v0.1 — Phase 0"}

    @app.get("/health")
    def health_check():
        return {"status": "ok"}

    @app.get("/health/db")
    def health_db(db: Session = Depends(get_db)):
        # Toca o DB (SELECT 1): readiness probe manual. Sem auth de propósito.
        # NÃO chamar periodicamente: manter o Azure SQL serverless acordado esgotou
        # a quota gratuita em agosto. Depois de 60 min parado, o 1.º pedido demora
        # 30–60 s a acordar a base; as apps mostram «Connecting to the server…».
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}

    # A rota POST /api/v1/scan foi REMOVIDA a 25/08/2026.
    #
    # Estimava peso a partir de uma FOTOGRAFIA 2D, com detecção YOLO e um Random
    # Forest treinado sobre dados sintéticos. Pertencia à arquitectura anterior
    # ao LiDAR, e o caminho de produção nunca a usou: a app calcula o peso no
    # próprio dispositivo, a partir da malha.
    #
    # Devolvia 500 a qualquer chamada autenticada, porque o Dockerfile instala
    # requirements-api.txt, que exclui ultralytics e opencv. Um erro de servidor
    # numa rota que não devia existir é pior do que a rota não existir: passa a
    # responder 404, que é a verdade.
    #
    # O código continua em models/detector.py e models/weight_estimator.py,
    # marcado como legado.

    app.include_router(auth_router)
    # Antes de organizations_router: /organizations/search colidia com /{organization_id}.
    app.include_router(organization_access_router)
    app.include_router(weather_router)
    app.include_router(client_errors_router)
    app.include_router(organizations_router)
    app.include_router(users_router)
    app.include_router(organizations_member_router)
    app.include_router(species_router)
    app.include_router(breeds_router)
    app.include_router(animals_router)
    app.include_router(animal_documents_router)
    app.include_router(scans_router)
    app.include_router(veterinary_appointments_router)
    app.include_router(predictions_router)
    return app


app = create_app()

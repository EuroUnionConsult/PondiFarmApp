from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

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
from core.database import get_db, initialize_database
from core.errors import register_exception_handlers


def create_app() -> FastAPI:
    app = FastAPI(title="PondiFarm API", version="0.1.0")
    # CORS configurável por env (D.6): restringir em produção via CORS_ORIGINS
    # (lista separada por vírgula). O app nativo não usa CORS; isto é só p/ docs/ferramentas.
    import os

    cors_origins = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

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
        # Toca o DB (SELECT 1) — mantém o Azure SQL free-tier acordado (keep-alive)
        # e serve como readiness probe. Sem auth de propósito.
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

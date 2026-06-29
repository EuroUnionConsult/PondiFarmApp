import io

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from api.v1.organizations.organizations_routes import organizations_router
from api.v1.species.species_routes import species_router
from api.v1.breeds.breeds_routes import breeds_router
from api.v1.animals.animals_routes import animals_router
from api.v1.scans.scans_routes import scans_router
from api.v1.veterinary_appointments.veterinary_appointments_routes import (
    veterinary_appointments_router,
)
from api.v1.users.users_routes import users_router
from api.v1.organizations_members.organizations_members_routes import (
    organizations_member_router,
)
from api.v1.predictions.prediction_routes import predictions_router
from core.database import initialize_database
from core.errors import register_exception_handlers


def create_app() -> FastAPI:
    app = FastAPI(title="PondiFarm API", version="0.1.0")
    # CORS aberto para demo Fase 0 — restringir em produção
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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

    @app.post("/api/v1/scan")
    async def scan(
        file: UploadFile = File(...),
        animal_id: str = Form(default="DEMO-001"),
        breed: str = Form(default="default"),
    ):
        import cv2
        import numpy as np
        from PIL import Image

        from models.detector import detect_subject
        from models.weight_estimator import estimate_weight
        from utils.geometry import bbox_to_measurements

        contents = await file.read()
        img_pil = Image.open(io.BytesIO(contents)).convert("RGB")
        img_np = np.array(img_pil)
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        detection = detect_subject(img_bgr)

        if detection is None:
            raise HTTPException(
                status_code=422,
                detail="Nenhum objeto detectado na imagem. Certifique-se de que o animal/objeto está visível e bem iluminado.",
            )

        h, w = img_bgr.shape[:2]
        measurements = bbox_to_measurements(
            bbox=detection["bbox"],
            img_h=h,
            img_w=w,
            breed=breed.lower(),
        )

        peso_kg, confianca = estimate_weight(measurements)

        return {
            "animal_id": animal_id,
            "breed": breed,
            "detection": {
                "class": detection["class_name"],
                "confidence_pct": detection["confidence"],
                "is_real_animal": detection["is_real_animal"],
                "mode": "2D sem LiDAR — Fase 0",
            },
            "measurements": {
                "body_length_cm": measurements["body_length_cm"],
                "withers_height_cm": measurements["withers_height_cm"],
                "thoracic_depth_cm": measurements["thoracic_depth_cm"],
                "rump_width_cm": measurements["rump_width_cm"],
                "chest_girth_cm": measurements["chest_girth_cm"],
            },
            "result": {
                "estimated_weight_kg": peso_kg,
                "confidence_pct": confianca,
                "accuracy_note": "Estimativa por visão computacional 2D · Precisão aumentada com LiDAR na versão final",
            },
        }

    app.include_router(organizations_router)
    app.include_router(users_router)
    app.include_router(organizations_member_router)
    app.include_router(species_router)
    app.include_router(breeds_router)
    app.include_router(animals_router)
    app.include_router(scans_router)
    app.include_router(veterinary_appointments_router)
    app.include_router(predictions_router)
    return app


app = create_app()

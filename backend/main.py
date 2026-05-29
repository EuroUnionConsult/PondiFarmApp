from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
from PIL import Image
import io

from models.detector import detect_subject
from models.weight_estimator import estimate_weight
from utils.geometry import bbox_to_measurements

app = FastAPI(title="PondiFarm API", version="0.1.0")

# CORS aberto para demo Fase 0 — restringir em produção
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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

from ultralytics import YOLO
from typing import Optional
import numpy as np

_model = None

# Classes COCO que aceitamos como "animal" para o demo
ANIMAL_CLASSES = {
    16: "bird",
    17: "cat",
    18: "dog",
    19: "horse",
    20: "sheep",
    21: "cow",
    22: "elephant",
    23: "bear",
    24: "zebra",
    25: "giraffe",
    # Objetos para demo (qualquer coisa grande serve para testar)
    0: "person",
    56: "chair",
    57: "couch",
    58: "plant",
    60: "dining table",
    63: "laptop",
    67: "cell phone",
    73: "book",
}


def get_model():
    global _model
    if _model is None:
        _model = YOLO("yolov8n.pt")
    return _model


def detect_subject(image_array: np.ndarray) -> Optional[dict]:
    """
    Detecta o sujeito principal na imagem.
    Prioriza animais; aceita qualquer objeto grande para demo.
    Retorna bbox do objeto com maior área detectado.
    """
    model = get_model()
    results = model(image_array, verbose=False)[0]

    if results.boxes is None or len(results.boxes) == 0:
        return None

    best = None
    best_area = 0

    for box in results.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        area = (x2 - x1) * (y2 - y1)

        if conf < 0.35:
            continue

        # Prioridade: animais reais primeiro
        is_animal = cls_id in ANIMAL_CLASSES and cls_id <= 25
        priority_score = area * (2.0 if is_animal else 1.0)

        if priority_score > best_area:
            best_area = priority_score
            best = {
                "bbox": [x1, y1, x2, y2],
                "class_id": cls_id,
                "class_name": ANIMAL_CLASSES.get(cls_id, "objeto"),
                "confidence": round(conf * 100, 1),
                "is_real_animal": is_animal,
            }

    return best

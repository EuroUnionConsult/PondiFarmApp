# PondiFarm Backend

FastAPI service for the PondiFarmApp pipeline. Receives an image, runs object detection, computes morphometric measurements, and returns an estimated weight and confidence score.

## Stack

- Python 3.9+
- FastAPI 0.111
- Ultralytics YOLOv8 (object detection)
- scikit-learn Random Forest (weight estimator)
- OpenCV, NumPy, Pillow

## Project structure

```
backend/
├── main.py                 FastAPI entry point and HTTP routes
├── models/
│   ├── detector.py         YOLOv8 wrapper used by /api/v1/scan
│   ├── weight_estimator.py Random Forest inference
│   └── rf_model.pkl        Trained Random Forest (Git LFS)
├── utils/
│   └── geometry.py         Bounding-box → morphometric features
├── requirements.txt        Pinned dependencies
└── ruff.toml               Linter configuration
```

The trained Random Forest (`rf_model.pkl`) and the YOLOv8 weights (`yolov8n.pt`) are tracked via **Git LFS**. Make sure Git LFS is installed and `git lfs pull` has been run before starting the server.

## Local development

### 1. Create and activate a virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Start the API

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is then available at `http://localhost:8000`.

### 4. Check the service

```bash
curl http://localhost:8000/health
# → {"status":"ok"}

curl http://localhost:8000/
# → {"status":"ok","service":"PondiFarm API v0.1 — Phase 0"}
```

## API surface

### `GET /health`

Lightweight liveness probe. Returns `{"status": "ok"}`.

### `GET /`

Service banner — name and phase.

### `POST /api/v1/scan`

Multipart form upload with the following fields:

| Field        | Type      | Required | Default     |
|--------------|-----------|----------|-------------|
| `file`       | file      | yes      | —           |
| `animal_id`  | string    | no       | `DEMO-001`  |
| `breed`      | string    | no       | `default`   |

Returns a JSON object containing the detection, the five morphometric measurements (`body_length_cm`, `withers_height_cm`, `thoracic_depth_cm`, `rump_width_cm`, `chest_girth_cm`), and the weight estimate with a confidence score.

A `422` is returned when no subject is detected in the image.

## Linting and formatting

```bash
ruff check .
ruff format .
```

## Notes

- CORS is currently fully permissive (`allow_origins=["*"]`). This is acceptable for the Phase 0 demo; production deployments must restrict the allowlist before being exposed beyond a development network.
- The service does not persist any data. State is held in the client.
- A future iteration will add tests and a `pytest` configuration.

## Licence

See the repository root [`LICENSE`](../LICENSE) for the proprietary terms that govern this code.

# PondiFarm Backend

FastAPI service for the PondiFarmApp pipeline. Receives an image, runs object detection, computes morphometric measurements, and returns an estimated weight and confidence score.

## Stack

- Python 3.9+
- FastAPI 0.111
- SQLAlchemy 2.0
- Pydantic
- passlib with PBKDF2-SHA256 for password hashing
- Ultralytics YOLOv8 (object detection)
- scikit-learn (offline weight model training and optional inference)
- OpenCV, NumPy, Pillow

## Project structure

```txt
backend/
|-- api/
|   `-- v1/
|       |-- auth/
|       |   `-- auth_routes.py
|       |-- organizations/
|       |   `-- organizations_routes.py
|       `-- users/
|           `-- users_routes.py
|-- core/
|   |-- config.py
|   |-- database.py
|   |-- errors.py
|   `-- security.py
|-- models/
|   |-- detector.py
|   |-- models.py
|   `-- weight_estimator.py
|-- ml/
|   |-- datasets/
|   |-- models/
|   |-- preprocessing/
|   `-- training/
|-- prediction/
|   |-- model_registry.py
|   |-- predictor.py
|   `-- schemas.py
|-- repositories/
|   |-- organization_member_repository.py
|   |-- organization_repository.py
|   `-- user_repository.py
|-- schemas/
|   |-- base.py
|   |-- organization_member_schemas.py
|   |-- organization_schemas.py
|   `-- user_schemas.py
|-- services/
|   |-- organization_member_service.py
|   |-- organization_service.py
|   `-- user_service.py
|-- tests/
|   `-- test_api.py
|-- utils/
|   `-- geometry.py
|-- main.py
|-- requirements.txt
`-- ruff.toml
```

## Database configuration

The application is configured to use your Azure SQL / SQL Server database. Do not hardcode production credentials in the repository.

Examples:

```bash
# Full SQLAlchemy URL
export DATABASE_URL="mssql+pyodbc://USER:PASSWORD@HOST:1433/DATABASE?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"

# Or compose the Azure SQL connection from environment variables
export AZURE_SQL_SERVER="your-server.database.windows.net"
export AZURE_SQL_DATABASE="pondifarm"
export AZURE_SQL_USERNAME="your-user"
export AZURE_SQL_PASSWORD="your-password"
export AZURE_SQL_DRIVER="ODBC Driver 17 for SQL Server"
export AZURE_SQL_ENCRYPT="yes"
export AZURE_SQL_TRUST_SERVER_CERTIFICATE="no"
```

The backend no longer falls back to SQLite at runtime. It expects `DATABASE_URL` or the Azure SQL variables above to be present. The service does not auto-create schema objects in Azure SQL; it maps to the existing tables.

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

## API surface

### Health

- `GET /health`
- `GET /`

### Scan

- `POST /api/v1/scan`

Multipart form upload:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `file` | file | yes | - |
| `animal_id` | string | no | `DEMO-001` |
| `breed` | string | no | `default` |

The scan response includes `model_version`, `estimation_method`, and
`diagnostics` inside `result`. If
`backend/ml/models/weight/external-trained-v0.1.0.joblib` is not present, the
backend uses the formula fallback `formula-baseline-v0.1.0`.

## Offline external dataset training

External cattle datasets must be reviewed and staged manually. The API never
downloads datasets and never trains inside request handlers.

The internal normalized CSV schema and manual staging rules are documented in
`backend/ml/datasets/README.md`.

Normalize a reviewed external CSV:

```bash
python -m ml.preprocessing.external_dataset_normalizer backend/ml/datasets/external/raw.csv backend/ml/datasets/processed/normalized.csv --dataset-source CowDatabase
```

Train a supervised model from a normalized CSV:

```bash
python -m ml.training.train_weight_model backend/ml/datasets/processed/normalized.csv
```

Generated model artifacts are written to:

- `backend/ml/models/weight/external-trained-v0.1.0.joblib`
- `backend/ml/models/weight/external-trained-v0.1.0.metadata.json`

These generated files are ignored by default. Review metrics and repository
artifact strategy before committing any model file.

### Organizations

- `POST /api/v1/organizations`
- `GET /api/v1/organizations`
- `GET /api/v1/organizations/{organizationId}`
- `PATCH /api/v1/organizations/{organizationId}`
- `DELETE /api/v1/organizations/{organizationId}`

Create example:

```bash
curl -X POST http://localhost:8000/api/v1/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PondiFarm",
    "documentNumber": "123456789",
    "phone": "+351900000000",
    "email": "contact@pondifarm.com",
    "address": "Porto, Portugal"
  }'
```

### Users

- `POST /api/v1/users`
- `GET /api/v1/users`
- `GET /api/v1/users/{userId}`
- `PATCH /api/v1/users/{userId}`
- `DELETE /api/v1/users/{userId}`

Create example:

```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bruno Silva",
    "email": "bruno@example.com",
    "password": "password-value"
  }'
```

### Organization members

- `GET /api/v1/organizations/{organizationId}/members`
- `POST /api/v1/organizations/{organizationId}/members`
- `PATCH /api/v1/organizations/{organizationId}/members/{memberId}`
- `DELETE /api/v1/organizations/{organizationId}/members/{memberId}`

Add member example:

```bash
curl -X POST http://localhost:8000/api/v1/organizations/{organizationId}/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "00000000-0000-0000-0000-000000000001",
    "role": "manager"
  }'
```

List members example:

```bash
curl http://localhost:8000/api/v1/organizations/{organizationId}/members
```

## Soft delete behavior

The `organizations`, `users`, and `organization_members` resources now use soft delete only.

- `DELETE` sets `deleted_at` and `updated_at` instead of removing the row.
- Normal `GET` endpoints return only active rows where `deleted_at IS NULL`.
- `PATCH` on a soft-deleted record returns `404`.
- User responses still never expose `password_hash`.

If you need to prepare Azure SQL for this behavior, run [backend/sql/add_deleted_at_soft_delete.sql](/C:/EUCInovacao/PondiFarmApp/backend/sql/add_deleted_at_soft_delete.sql) against the existing database.

## Registration rules

Current user and organization registration rules:

- User emails are normalized to lowercase and must be unique across the whole system.
- Organization document numbers are normalized by removing formatting characters and must be unique across the whole system.
- All organization memberships currently use the role `viewer`.
- No RBAC or differentiated organization roles are implemented yet.

If you need to prepare Azure SQL for these rules, run [backend/sql/add_registration_business_rules.sql](/C:/EUCInovacao/PondiFarmApp/backend/sql/add_registration_business_rules.sql).

## Tests

```bash
python -m unittest discover tests
```

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

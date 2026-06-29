# PondiFarm Backend

FastAPI service for the PondiFarmApp pipeline. Receives an image, runs object detection, computes morphometric measurements, and returns an estimated weight and confidence score.

## Stack

- Python 3.9+
- FastAPI 0.111
- SQLAlchemy 2.0
- Pydantic
- passlib with PBKDF2-SHA256 for password hashing
- Ultralytics YOLOv8 (object detection)
- scikit-learn Random Forest (weight estimator)
- OpenCV, NumPy, Pillow

## Project structure

```txt
backend/
|-- api/
|   `-- v1/
|       |-- animals/
|       |   `-- animals_routes.py
|       |-- breeds/
|       |   `-- breeds_routes.py
|       |-- organizations/
|       |   `-- organizations_routes.py
|       |-- organizations_members/
|       |   `-- organizations_members_routes.py
|       |-- scans/
|       |   `-- scans_routes.py
|       |-- species/
|       |   `-- species_routes.py
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
|   |-- rf_model.pkl
|   `-- weight_estimator.py
|-- repositories/
|   |-- organization_member_repository.py
|   |-- organization_repository.py
|   |-- scan_repository.py
|   |-- species_repository.py
|   |-- breed_repository.py
|   `-- animal_repository.py
|-- schemas/
|   |-- animal_schemas.py
|   |-- breed_schemas.py
|   |-- base.py
|   |-- organization_member_schemas.py
|   |-- organization_schemas.py
|   |-- scan_schemas.py
|   |-- species_schemas.py
|   `-- user_schemas.py
|-- services/
|   |-- animal_service.py
|   |-- breed_service.py
|   |-- organization_member_service.py
|   |-- organization_service.py
|   |-- scan_service.py
|   |-- species_service.py
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

The backend no longer falls back to SQLite at runtime. It expects `DATABASE_URL` or the Azure SQL variables above to be present.

On startup the service:

- creates any missing mapped tables with SQLAlchemy `create_all()`
- runs a small compatibility patch for legacy `species` and `breeds` tables so `normalized_name` exists and is backfilled
- seeds the default species list and common bovine breeds

This startup bootstrap is useful for local environments, but it is not a replacement for a real migration workflow.

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

### Health and legacy prototype

| Method | Path | Purpose |
|-------|------|---------|
| `GET` | `/` | Service banner and basic status payload |
| `GET` | `/health` | Lightweight health check |
| `POST` | `/api/v1/scan` | Legacy Phase 0 multipart image scan endpoint |

The legacy `POST /api/v1/scan` endpoint accepts multipart form data:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `file` | file | yes | - |
| `animal_id` | string | no | `DEMO-001` |
| `breed` | string | no | `default` |

### Predictions

- `POST /api/v1/predictions/weight-estimation`

JSON request example:

```bash
curl -X POST http://localhost:8000/api/v1/predictions/weight-estimation \
  -H "Content-Type: application/json" \
  -d '{
    "species": "cattle",
    "breed": "minhota",
    "sex": "female",
    "age_months": 28,
    "measurements": {
      "body_length_cm": 152.4,
      "withers_height_cm": 126.8,
      "thoracic_depth_cm": 65.9,
      "rump_width_cm": 50.2,
      "chest_girth_cm": 194.3
    }
  }'
```

This endpoint does not persist any data. It validates morphometric measurements and returns a formula-based approximate weight estimate with conservative diagnostics.

### Organizations

| Method | Path | Purpose |
|-------|------|---------|
| `POST` | `/api/v1/organizations` | Create an organization |
| `GET` | `/api/v1/organizations` | List active organizations |
| `GET` | `/api/v1/organizations/{organizationId}` | Fetch one organization |
| `PATCH` | `/api/v1/organizations/{organizationId}` | Update organization data |
| `DELETE` | `/api/v1/organizations/{organizationId}` | Soft-delete an organization |

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

| Method | Path | Purpose |
|-------|------|---------|
| `POST` | `/api/v1/users` | Create a user |
| `GET` | `/api/v1/users` | List active users |
| `GET` | `/api/v1/users/{userId}` | Fetch one user |
| `PATCH` | `/api/v1/users/{userId}` | Update user profile or password |
| `DELETE` | `/api/v1/users/{userId}` | Soft-delete a user |

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

| Method | Path | Purpose |
|-------|------|---------|
| `GET` | `/api/v1/organizations/{organizationId}/members` | List active members |
| `POST` | `/api/v1/organizations/{organizationId}/members` | Add a user to an organization |
| `PATCH` | `/api/v1/organizations/{organizationId}/members/{memberId}` | Update a membership |
| `DELETE` | `/api/v1/organizations/{organizationId}/members/{memberId}` | Soft-delete a membership |

Add member example:

```bash
curl -X POST http://localhost:8000/api/v1/organizations/{organizationId}/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "00000000-0000-0000-0000-000000000001",
    "role": "viewer"
  }'
```

### Species and breeds

| Method | Path | Purpose |
|-------|------|---------|
| `GET` | `/api/v1/species` | List active species |
| `POST` | `/api/v1/species` | Create a species |
| `GET` | `/api/v1/species/{speciesId}` | Fetch one species |
| `PATCH` | `/api/v1/species/{speciesId}` | Update a species |
| `DELETE` | `/api/v1/species/{speciesId}` | Soft-delete a species when safe |
| `GET` | `/api/v1/species/{speciesId}/breeds` | List breeds for one species |
| `POST` | `/api/v1/species/{speciesId}/breeds` | Create a breed under a species |
| `GET` | `/api/v1/breeds/{breedId}` | Fetch one breed |
| `PATCH` | `/api/v1/breeds/{breedId}` | Update a breed |
| `DELETE` | `/api/v1/breeds/{breedId}` | Soft-delete a breed when safe |

Supported list filters:

- `GET /api/v1/species`: `search`, `page`, `limit`
- `GET /api/v1/species/{speciesId}/breeds`: `search`, `page`, `limit`

### Animals

| Method | Path | Purpose |
|-------|------|---------|
| `GET` | `/api/v1/organizations/{organizationId}/animals` | List animals for one organization |
| `POST` | `/api/v1/animals` | Create an animal |
| `GET` | `/api/v1/animals/{animalId}` | Fetch one animal |
| `PATCH` | `/api/v1/animals/{animalId}` | Update an animal |
| `DELETE` | `/api/v1/animals/{animalId}` | Soft-delete an animal |

Supported list filters:

- `search`
- `speciesId`
- `breedId`
- `sex`
- `page`
- `limit`

### Animal scans

| Method | Path | Purpose |
|-------|------|---------|
| `POST` | `/api/v1/animals/{animalId}/scans` | Create a scan record for an animal |
| `GET` | `/api/v1/animals/{animalId}/scans` | List scans for an animal |
| `GET` | `/api/v1/scans/{scanId}` | Fetch one scan |
| `PATCH` | `/api/v1/scans/{scanId}` | Update scan status, timestamp, or notes |
| `DELETE` | `/api/v1/scans/{scanId}` | Soft-delete or archive a scan |

`POST /api/v1/animals/{animalId}/scans` only accepts client-supplied metadata:

```json
{
  "scanSource": "polycam",
  "scannedAt": "2026-06-04T22:15:00.558Z",
  "notes": "Initial capture"
}
```

The remaining scan fields are server-managed. `animal_id` comes from the URL, `organization_id` is copied from the animal, `scan_status` starts as `pending_upload`, and measurement/result fields are expected to be populated by later processing steps.

Supported list filters:

- `status`
- `source`
- `dateFrom`
- `dateTo`
- `page`
- `limit`

## Business rules

### Cross-cutting rules

- Most resources use soft delete. Normal list and fetch operations only return active rows where `deleted_at IS NULL`.
- `PATCH` against a soft-deleted resource behaves like the resource does not exist and returns `404`.
- Pagination defaults to `page=1` and `limit=20` on list endpoints that support paging, with `limit <= 100`.
- Authentication and authorization are not implemented yet. Several services include TODOs for membership checks.

### Organization rules

- `documentNumber` must be a valid Portuguese NIF.
- NIF values are normalized to digits only before persistence.
- Organization document numbers must be unique across the system.

### User rules

- `email` is normalized to lowercase and trimmed before persistence.
- User emails must be unique across the system.
- Passwords are hashed with PBKDF2-SHA256 before storage.
- API responses never expose `password_hash`.

### Organization membership rules

- Only the `viewer` role is currently accepted by the API.
- Creating the same active membership twice returns `409`.
- Re-adding a previously soft-deleted membership reactivates the old row instead of creating a new one.
- Member lists exclude memberships whose user has been soft-deleted.

### Species and breed rules

- Species names are normalized case-insensitively for uniqueness.
- Breed names are normalized case-insensitively within each species.
- The same breed name can exist under different species.
- Species cannot be deleted while linked active breeds or active animals still exist.
- Breeds cannot be deleted while linked active animals still exist.

### Animal rules

- An animal must reference an existing organization, species, and breed.
- The selected breed must belong to the selected species.
- `tagCode` is optional, but when provided it is trimmed and must be unique within the organization.
- The same `tagCode` can be reused in a different organization.
- `sex` must be one of `male`, `female`, or `unknown`.
- `birthDate` cannot be in the future.

### Animal scan rules

- A scan can only be created for an existing animal.
- Only one active unfinished scan is allowed per animal at a time.
- Unfinished statuses are `pending_upload`, `uploaded`, `validating`, and `processing`.
- `scanSource` must be one of `polycam`, `manual`, or `imported`.
- `scannedAt` cannot be in the future.
- New scans always start with status `pending_upload`.
- Allowed status transitions are:

| Current | Allowed next statuses |
|-------|------------------------|
| `pending_upload` | `uploaded`, `archived` |
| `uploaded` | `validating`, `failed` |
| `validating` | `processing`, `validation_failed` |
| `processing` | `completed`, `failed` |
| `validation_failed` | `archived` |
| `completed` | `archived` |
| `failed` | `archived` |
| `archived` | none |

- Deleting a scan in `processing` returns `409`.
- Deleting a scan in `completed` archives it instead of soft-deleting it.
- Deleting a scan in other states sets `deleted_at`.

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
- The backend persists its domain data in SQL Server and seeds baseline species and common bovine breeds on startup.
- The current automated coverage is based on `unittest` smoke and CRUD tests in [backend/tests/test_api.py](/C:/EUCInovacao/PondiFarmApp/backend/tests/test_api.py) and compatibility coverage in [backend/tests/test_database_compatibility.py](/C:/EUCInovacao/PondiFarmApp/backend/tests/test_database_compatibility.py).

## Licence

See the repository root [`LICENSE`](../LICENSE) for the proprietary terms that govern this code.

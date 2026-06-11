# Weight Estimation Endpoint Notes

This endpoint adds a direct way to test formula-based livestock weight estimation without storing any data in the database.

## What was added

- A new route at `POST /api/v1/predictions/weight-estimation`
- Integration tests using FastAPI `TestClient`
- Swagger/OpenAPI request example for manual testing

## Why this endpoint exists

This route is useful as an isolated validation step before connecting weight estimation to persisted scan workflows. It lets the team verify request validation, response shape, diagnostics, and predictor integration without coupling the work to image upload or database persistence.

## Request and response flow

1. FastAPI receives the HTTP request body.
2. The `WeightEstimationRequest` Pydantic schema validates and parses the payload.
3. The route calls the existing formula-based predictor from `backend/prediction/`.
4. The predictor returns a `WeightEstimationResponse` with an estimated weight, conservative confidence score, and diagnostics.
5. FastAPI serializes the response into JSON and exposes it in Swagger.

## Validation behavior

- Valid payloads return `200 OK`.
- Invalid payloads for this route return `422 Unprocessable Entity`.
- The route uses a route-specific validation handler so the new endpoint can follow standard FastAPI `422` behavior without changing the validation behavior of unrelated legacy endpoints.

## Important implementation detail

The repository uses a shared Pydantic base model with camelCase aliases for JSON serialization. The prediction module keeps snake_case field names in Python code, while the API can still accept the snake_case example payload and serialize responses consistently with the existing project conventions.

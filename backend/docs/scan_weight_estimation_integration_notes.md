# Scan weight estimation integration notes

This document explains the integration of the persisted weight estimation endpoint:

`POST /api/v1/scans/{scan_id}/estimate-weight`

The goal is to make weight estimation part of the real workflow for scans stored in the database, while keeping it explicit that the calculated value is a formula-based approximation and not a real weight measured on a scale.

## 1. What was created

The `AnimalScan` model was aligned with the existing `animal_scans` table in the database. The API uses clear names such as `body_length_cm`, `chest_girth_cm`, and `estimated_weight_kg`, while SQLAlchemy writes to the existing columns such as `body_length`, `chest_circumference`, and `estimated_weight`.

The following pieces were also created:

- `backend/schemas/scan_schemas.py`: Pydantic schemas for scan responses and the future real-weight payload.
- `backend/repositories/scan_repository.py`: queries and basic persistence for active scans.
- `backend/services/scan_service.py`: business logic for persisted estimation.
- `backend/api/v1/scans/scans_routes.py`: FastAPI route for the integrated endpoint.
- `backend/tests/test_scan_weight_estimation_integration.py`: integration tests for the new flow.

## 2. How it worked before and how it works now

Previously, the backend had a direct prediction endpoint:

`POST /api/v1/predictions/weight-estimation`

That endpoint receives measurements in the payload, runs the baseline estimator, and returns the result without saving anything to the database.

After the integration, there is also a persisted endpoint:

`POST /api/v1/scans/{scan_id}/estimate-weight`

This endpoint loads an existing scan, validates the measurements, runs the same estimation agent, and stores the result in the `animal_scans` record.

## 3. How the full flow works

1. The client calls `POST /api/v1/scans/{scan_id}/estimate-weight`.
2. The FastAPI route receives the `scan_id` and a SQLAlchemy session.
3. The service loads the active scan from the database.
4. If the scan does not exist, it returns `404`.
5. The service validates that the required measurements are present.
6. If `body_length_cm` or `chest_girth_cm` is missing, it returns `409` and does not run the agent.
7. The scan is marked as `processing`.
8. The service builds a `WeightEstimationRequest`.
9. The Formula-Based Weight Estimation Agent calculates the estimate.
10. The result is stored in the scan using the existing columns: `estimated_weight`, `confidence_score`, `scan_status`, and `raw_result_json`.
11. The scan is marked as `completed`.
12. The API returns the updated `AnimalScanResponse`.
13. If an unexpected error occurs, the scan is marked as `failed`.

## 4. What `scan_id` is

`scan_id` is the unique identifier of a persisted scan. It appears in the URL because the estimation must be applied to one specific scan that already exists in the database.

Using the ID in the URL follows a common REST API pattern: the main resource is `/scans/{scan_id}` and the action applied to that resource is `/estimate-weight`.

## 5. What persistence means

Persistence means saving data in durable storage, such as a SQL database.

The direct prediction endpoint calculates and returns the result, but does not store anything. The integrated endpoint saves `estimated_weight_kg`, `confidence_score`, version, method, diagnostics, and the raw result in the scan record.

## 6. What a SQLAlchemy model is

A SQLAlchemy model is the Python representation of a database table.

In this case, `AnimalScan` represents `animal_scans`. Each model attribute corresponds to a column, such as `body_length_cm`, `estimated_weight_kg`, or `real_weight_kg`.

When we change the model, we are telling the Python code which columns it expects to find in the database.

## 7. What a Pydantic schema is

A Pydantic schema defines how data enters and leaves the API.

`AnimalScanResponse` controls the endpoint response. It avoids exposing unwanted internal details and transforms Python-style names into camelCase in the JSON response, following the project's current pattern.

## 8. What a migration or SQL script is

When we add new fields to the database, we usually need a migration or SQL script.

In this implementation, however, it was not necessary to create a new SQL script because the `animal_scans` table already exists. The work here was to map the clear Python names to the current database columns:

- `body_length_cm` -> `body_length`
- `withers_height_cm` -> `withers_height`
- `chest_girth_cm` -> `chest_circumference`
- `rump_width_cm` -> `hip_width`
- `estimated_weight_kg` -> `estimated_weight`

Details that do not have their own dedicated columns, such as version, method, and diagnostics, are stored inside `raw_result_json`.

## 9. Difference between `estimated_weight_kg` and `real_weight_kg`

`estimated_weight_kg` is the weight calculated by the formula-based agent.

`real_weight_kg` is the actual weight reported by an external source, such as a scale.

The current system uses `estimated_weight_kg` to provide an approximation. `real_weight_kg` remains separate for future use, once the team is able to weigh some animals in the field.

## 10. Why `real_weight_kg` remains optional

At this stage, the animal will not necessarily be weighed on a scale. If the system required `real_weight_kg`, many valid scans could not be estimated.

By keeping this field optional, the backend works now and is already prepared to receive real-weight data in the future.

## 11. What ground truth means

Ground truth is the real answer used as the reference. In weight estimation, the ground truth would be the weight measured by a reliable source, especially a scale.

Without ground truth, we can estimate, but we cannot measure the real error of that estimate for a given animal.

## 12. Why this is not supervised machine learning yet

The current agent does not learn from project-specific data. It uses a morphometric formula based on `chest_girth_cm` and `body_length_cm`, along with conservative diagnostics.

Because of that, it should be described as a formula-based baseline, not as a trained model.

## 13. How this can become machine learning in the future

In the future, if the database contains LiDAR measurements together with verified real weights, the team will be able to train a supervised model.

For that training process, the most reliable records would be those with:

- `real_weight_source = 'scale'`
- `is_ground_truth_verified = true`

## 14. What `confidence_score` is

`confidence_score` is a conservative confidence indicator for the estimate. It helps communicate the relative quality of the input, but it does not guarantee that the calculated weight is correct.

The value is intentionally capped in a conservative way by the current agent.

## 15. What `diagnostics_json` is

`estimation_diagnostics_json` stores diagnostic warnings and metadata, such as:

- whether the input is valid;
- whether there are plausibility warnings;
- whether ground-truth validation is required;
- whether the estimator is formula-based or a trained model.

This JSON supports auditing, debugging, and future analysis without requiring a dedicated column for every small detail.

## 16. What `raw_result_json` is

`raw_result_json` stores the full raw output of the agent.

This is useful for auditing because it preserves exactly what the agent returned at that moment: estimated weight, confidence, version, method, and diagnostics.

## 17. Why we use `processing` / `completed` / `failed` statuses

The status shows which stage the scan is currently in.

- `processing`: estimation has started.
- `completed`: estimation finished and was saved.
- `failed`: an unexpected error occurred.

This control prevents a scan from looking completed when it actually failed and helps identify operational issues.

## 18. How the tests work

The tests create an in-memory SQLite database, insert scans directly, and call the endpoint through `TestClient`.

They verify:

- `404` for a nonexistent scan;
- `409` when required measurements are missing;
- `200` when the scan is valid;
- persistence of estimated weight, confidence, and raw result;
- extraction of version, method, and diagnostics from `raw_result_json`;
- `failed` status on unexpected errors;
- separation between `estimated_weight_kg` and `real_weight_kg`;
- optional real weight without blocking the estimate.

## 19. How to test manually in Swagger or Postman

1. Create or locate a record in `animal_scans` with valid LiDAR measurements.
2. Make sure the scan includes `body_length_cm` and `chest_girth_cm`.
3. Also provide `withers_height_cm`, `thoracic_depth_cm`, and `rump_width_cm` when available, because they improve confidence diagnostics.
4. Start the backend.
5. Open `/docs` in the browser or use Postman.
6. Call `POST /api/v1/scans/{scan_id}/estimate-weight`.
7. Verify that the response contains `scanStatus = "completed"`.
8. Check `estimatedWeightKg`, `confidenceScore`, `estimationModelVersion`, `estimationMethod`, `estimationDiagnosticsJson`, and `rawResultJson`.
9. Query the database and confirm that the fields were saved in `animal_scans`.

## 20. Important points to remember

- The integrated endpoint loads an existing record; it does not calculate in a vacuum.
- `scan_id` identifies the persisted scan.
- Missing measurements generate a conflict before processing starts.
- Persistence writes the result to the database.
- The SQLAlchemy model represents the table.
- The Pydantic schema controls the JSON response.
- The model can map clear Python names to legacy database column names.
- The transaction prevents a scan from being left stuck in `processing`.
- Ground truth means reliable real weight.
- Estimated weight and real weight are separate concepts.
- A formula baseline is not a trained model.

## Suggested future task

Create:

`PATCH /api/v1/scans/{scan_id}/real-weight`

This endpoint should receive `real_weight_kg`, `real_weight_measured_at`, `real_weight_source`, `real_weight_notes`, and `is_ground_truth_verified`.

It should save the real weight without recalculating the estimate and should keep the rule that only records with `real_weight_source = "scale"` and `is_ground_truth_verified = true` are considered reliable candidates for future calibration or supervised training.

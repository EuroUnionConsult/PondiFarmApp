# Model artifacts

This directory stores optional offline-trained model artifacts.

The application must continue to work without any trained model file. When
`backend/ml/models/weight/external-trained-v0.1.0.joblib` is present, the
`ModelRegistry` can load it for supervised external-dataset predictions. When it
is absent, prediction falls back to `formula-baseline-v0.1.0`.

Generated artifacts:

- `backend/ml/models/weight/external-trained-v0.1.0.joblib`
- `backend/ml/models/weight/external-trained-v0.1.0.metadata.json`

Do not commit large trained model files without confirming the repository's Git
LFS and release strategy.

# Model artifacts

This directory stores optional offline-trained model artifacts.

The application must continue to work without any trained model file. When
`backend/ml/models/weight/external-trained-v0.1.0.joblib` is present, the
`prediction.model_registry.get_model_registry()` factory registers a
`TrainedWeightPredictor` alongside the formula baseline. The
`FormulaBasedWeightPredictor` always remains the registry default
(`get_default()`); the trained model is retrieved explicitly by its
`external-trained-v0.1.0` version. When the artifact is absent, only the
formula baseline (`formula-baseline-v0.1.0`) is registered.

Generated artifacts:

- `backend/ml/models/weight/external-trained-v0.1.0.joblib`
- `backend/ml/models/weight/external-trained-v0.1.0.metadata.json`

Do not commit large trained model files without confirming the repository's Git
LFS and release strategy.

from __future__ import annotations

from prediction.confidence import calculate_confidence_score
from prediction.feature_builder import build_formula_features
from prediction.formula_baseline import (
    ESTIMATION_METHOD,
    MODEL_VERSION,
    estimate_weight_from_formula,
)
from prediction.measurement_validator import validate_measurements
from prediction.schemas import (
    PredictionDiagnostics,
    WeightEstimationRequest,
    WeightEstimationResponse,
)


class FormulaBasedWeightPredictor:
    model_version = MODEL_VERSION
    estimation_method = ESTIMATION_METHOD

    def predict(
        self,
        request: WeightEstimationRequest,
    ) -> WeightEstimationResponse:
        validation_result = validate_measurements(request.measurements)
        features = build_formula_features(validation_result.measurements)
        estimation = estimate_weight_from_formula(features)
        confidence_score = calculate_confidence_score(
            validation_result=validation_result,
            features=features,
        )

        warnings = list(validation_result.warnings)
        warnings.extend(_build_context_warnings(request))
        warnings.append(
            "Estimation is based on a morphometric formula "
            "and has not been calibrated with ground-truth farm data.",
        )

        diagnostics = PredictionDiagnostics(
            input_quality=validation_result.input_quality,
            warnings=warnings,
            requires_ground_truth_validation=True,
            is_formula_based=True,
            is_trained_model=False,
        )

        return WeightEstimationResponse(
            estimated_weight_kg=round(estimation.estimated_weight_kg, 1),
            confidence_score=confidence_score,
            model_version=self.model_version,
            estimation_method=self.estimation_method,
            diagnostics=diagnostics,
        )


def _build_context_warnings(request: WeightEstimationRequest) -> list[str]:
    warnings: list[str] = []
    normalized_species = request.species.strip().lower()
    bovine_labels = {
        "bovine",
        "cattle",
        "cow",
        "bull",
        "heifer",
        "calf",
        "bos taurus",
        "bos indicus",
    }
    if normalized_species not in bovine_labels:
        warnings.append(
            "Plausibility checks are tuned for bovines "
            "and may not generalize to other species.",
        )

    if request.age_months < 6:
        warnings.append(
            "Very young animals can deviate materially "
            "from adult morphometric formulas.",
        )

    return warnings

from typing import Dict, Tuple

from prediction.predictor import estimate_weight as estimate_weight_with_registry


def estimate_weight(measurements: Dict[str, float]) -> Tuple[float, float]:
    """Backward-compatible tuple API for legacy callers.

    Returns `(estimated_weight_kg, confidence_pct)`.
    """
    prediction = estimate_weight_with_registry(measurements)
    return prediction.estimated_weight_kg, prediction.confidence_pct

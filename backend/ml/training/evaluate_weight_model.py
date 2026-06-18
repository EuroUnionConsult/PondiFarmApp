import math
from typing import Dict, Sequence

from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)


def evaluate_regression_model(
    true_weights: Sequence[float],
    predicted_weights: Sequence[float],
) -> Dict[str, float]:
    """Return standard cattle weight regression metrics."""
    mae = float(mean_absolute_error(true_weights, predicted_weights))
    rmse = float(math.sqrt(mean_squared_error(true_weights, predicted_weights)))
    mape = float(
        mean_absolute_percentage_error(true_weights, predicted_weights) * 100.0
    )
    r2 = float(r2_score(true_weights, predicted_weights))
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "r2": round(r2, 4),
    }

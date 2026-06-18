import argparse
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from ml.training.evaluate_weight_model import evaluate_regression_model


MODEL_VERSION = "external-trained-v0.1.0"
TARGET_NAME = "real_weight_kg"
FEATURE_NAMES = [
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]
DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "models"
    / "weight"
    / (MODEL_VERSION + ".joblib")
)
DEFAULT_METADATA_PATH = DEFAULT_MODEL_PATH.with_suffix(".metadata.json")


def train_weight_model(
    normalized_csv_path: Path,
    model_output_path: Path = DEFAULT_MODEL_PATH,
    metadata_output_path: Optional[Path] = None,
    test_size: float = 0.25,
    random_state: int = 42,
) -> Dict[str, object]:
    """Train candidate regressors from a normalized CSV and persist the winner."""
    feature_rows, target_values, dataset_sources = load_training_rows(
        normalized_csv_path
    )
    if len(feature_rows) < 4:
        raise ValueError("At least 4 valid training rows are required.")

    training_features, test_features, training_targets, test_targets = train_test_split(
        feature_rows,
        target_values,
        test_size=test_size,
        random_state=random_state,
    )

    candidates = build_candidate_models(random_state)
    evaluated_models: List[Tuple[str, Pipeline, Dict[str, float]]] = []
    for model_name, model in candidates.items():
        model.fit(training_features, training_targets)
        predictions = model.predict(test_features)
        metrics = evaluate_regression_model(test_targets, predictions)
        evaluated_models.append((model_name, model, metrics))

    best_model_name, best_model, best_metrics = select_best_model(evaluated_models)

    model_output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, model_output_path)

    metadata_path = metadata_output_path
    if metadata_path is None:
        metadata_path = model_output_path.with_suffix(".metadata.json")

    metadata = {
        "model_version": MODEL_VERSION,
        "model_type": best_model_name,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_sources": dataset_sources,
        "feature_names": FEATURE_NAMES,
        "target_name": TARGET_NAME,
        "metrics": best_metrics,
        "number_of_training_rows": len(training_features),
        "number_of_test_rows": len(test_features),
        "notes": (
            "Trained offline on externally sourced cattle datasets. "
            "Requires validation and calibration with PondiFarm/BoviScan ground truth before production trust."
        ),
        "is_external_dataset_model": True,
        "is_farm_calibrated_model": False,
    }

    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    with metadata_path.open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2, sort_keys=True)

    return metadata


def load_training_rows(
    normalized_csv_path: Path,
) -> Tuple[List[List[float]], List[float], List[str]]:
    feature_rows: List[List[float]] = []
    target_values: List[float] = []
    dataset_sources = set()

    with Path(normalized_csv_path).open(
        "r", encoding="utf-8-sig", newline=""
    ) as input_file:
        reader = csv.DictReader(input_file)
        for row in reader:
            target_value = parse_float(row.get(TARGET_NAME))
            body_length = parse_float(row.get("body_length_cm"))
            chest_girth = parse_float(row.get("chest_girth_cm"))
            if target_value is None or body_length is None or chest_girth is None:
                continue
            feature_row: List[float] = []
            for feature_name in FEATURE_NAMES:
                feature_value = parse_float(row.get(feature_name))
                if feature_value is None:
                    feature_row.append(math.nan)
                else:
                    feature_row.append(feature_value)
            feature_rows.append(feature_row)
            target_values.append(target_value)
            source_name = row.get("dataset_source", "").strip()
            if source_name:
                dataset_sources.add(source_name)

    return feature_rows, target_values, sorted(dataset_sources)


def build_candidate_models(random_state: int) -> Dict[str, Pipeline]:
    return {
        "LinearRegression": build_pipeline(LinearRegression()),
        "Ridge": build_pipeline(Ridge(alpha=1.0, random_state=random_state)),
        "RandomForestRegressor": build_pipeline(
            RandomForestRegressor(
                n_estimators=200,
                max_depth=8,
                random_state=random_state,
            ),
        ),
    }


def build_pipeline(regressor: object) -> Pipeline:
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("regressor", regressor),
        ],
    )


def select_best_model(
    evaluated_models: Sequence[Tuple[str, Pipeline, Dict[str, float]]],
) -> Tuple[str, Pipeline, Dict[str, float]]:
    return sorted(
        evaluated_models,
        key=lambda model_result: (
            model_result[2]["mae"],
            model_result[2]["mape"],
        ),
    )[0]


def parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    cleaned_value = value.strip().replace(",", ".")
    if cleaned_value == "":
        return None
    try:
        parsed_value = float(cleaned_value)
    except ValueError:
        return None
    if parsed_value <= 0:
        return None
    return parsed_value


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train an offline cattle weight model from a normalized CSV.",
    )
    parser.add_argument("normalized_csv_path", type=Path)
    parser.add_argument("--model-output-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--metadata-output-path", type=Path, default=None)
    args = parser.parse_args()

    metadata = train_weight_model(
        normalized_csv_path=args.normalized_csv_path,
        model_output_path=args.model_output_path,
        metadata_output_path=args.metadata_output_path,
    )
    print(json.dumps(metadata, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

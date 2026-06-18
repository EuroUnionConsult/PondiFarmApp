import argparse
import csv
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Union


NormalizedValue = Union[str, float, None]


NORMALIZED_COLUMNS = [
    "dataset_source",
    "external_animal_id",
    "breed",
    "sex",
    "age_months",
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
    "real_weight_kg",
]

MEASUREMENT_COLUMNS = [
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]

COLUMN_ALIASES = {
    "dataset": "dataset_source",
    "datasetsource": "dataset_source",
    "source": "dataset_source",
    "animalid": "external_animal_id",
    "externalanimalid": "external_animal_id",
    "id": "external_animal_id",
    "n": "external_animal_id",
    "breed": "breed",
    "sex": "sex",
    "gender": "sex",
    "agemonths": "age_months",
    "ageinmonths": "age_months",
    "bodylengthcm": "body_length_cm",
    "bodylength": "body_length_cm",
    "obliquebodylength": "body_length_cm",
    "obl": "body_length_cm",
    "withersheightcm": "withers_height_cm",
    "withersheight": "withers_height_cm",
    "wh": "withers_height_cm",
    "thoracicdepthcm": "thoracic_depth_cm",
    "thoracicdepth": "thoracic_depth_cm",
    "chestdepth": "thoracic_depth_cm",
    "cd": "thoracic_depth_cm",
    "rumpwidthcm": "rump_width_cm",
    "rumpwidth": "rump_width_cm",
    "iliumwidth": "rump_width_cm",
    "hipjointwidth": "rump_width_cm",
    "hipwidth": "rump_width_cm",
    "chestgirthcm": "chest_girth_cm",
    "chestgirth": "chest_girth_cm",
    "heartgirth": "chest_girth_cm",
    "chestheart": "chest_girth_cm",
    "hg": "chest_girth_cm",
    "realweightkg": "real_weight_kg",
    "realweight": "real_weight_kg",
    "weightkg": "real_weight_kg",
    "weight": "real_weight_kg",
    "wt": "real_weight_kg",
    "bodyweight": "real_weight_kg",
    "liveweight": "real_weight_kg",
    "liveweigth": "real_weight_kg",
    "liveweithg": "real_weight_kg",
}

EXTREME_VALUE_LIMITS = {
    "age_months": (0.0, 300.0),
    "body_length_cm": (30.0, 300.0),
    "withers_height_cm": (30.0, 250.0),
    "thoracic_depth_cm": (5.0, 200.0),
    "rump_width_cm": (5.0, 200.0),
    "chest_girth_cm": (40.0, 350.0),
    "real_weight_kg": (20.0, 2000.0),
}


@dataclass
class NormalizationReport:
    rows_read: int = 0
    rows_valid: int = 0
    rows_removed: int = 0
    removed_reasons: Dict[str, int] = field(default_factory=dict)

    def add_removed(self, reason: str) -> None:
        self.rows_removed += 1
        self.removed_reasons[reason] = self.removed_reasons.get(reason, 0) + 1

    def to_dict(self) -> Dict[str, object]:
        return {
            "rows_read": self.rows_read,
            "rows_valid": self.rows_valid,
            "rows_removed": self.rows_removed,
            "removed_reasons": self.removed_reasons,
        }


@dataclass
class NormalizationResult:
    rows: List[Dict[str, str]]
    report: NormalizationReport


def normalize_external_dataset(
    input_csv_path: Path,
    output_csv_path: Optional[Path] = None,
    dataset_source: Optional[str] = None,
) -> NormalizationResult:
    """Normalize one external CSV into the PondiFarm weight-training schema."""
    source_path = Path(input_csv_path)
    report = NormalizationReport()
    normalized_rows: List[Dict[str, str]] = []

    with source_path.open("r", encoding="utf-8-sig", newline="") as input_file:
        reader = csv.DictReader(input_file)
        if reader.fieldnames is None:
            return NormalizationResult(rows=[], report=report)

        column_map = build_column_map(reader.fieldnames)
        for raw_row in reader:
            report.rows_read += 1
            normalized_row = normalize_row(raw_row, column_map, dataset_source)
            removal_reason = get_removal_reason(normalized_row)
            if removal_reason is not None:
                report.add_removed(removal_reason)
                continue
            normalized_rows.append(format_row(normalized_row))

    report.rows_valid = len(normalized_rows)

    if output_csv_path is not None:
        write_normalized_csv(Path(output_csv_path), normalized_rows)

    return NormalizationResult(rows=normalized_rows, report=report)


def normalize_many_external_datasets(
    input_csv_paths: Sequence[Path],
    output_csv_path: Path,
) -> NormalizationReport:
    rows: List[Dict[str, str]] = []
    combined_report = NormalizationReport()

    for input_csv_path in input_csv_paths:
        result = normalize_external_dataset(input_csv_path)
        rows.extend(result.rows)
        combined_report.rows_read += result.report.rows_read
        combined_report.rows_removed += result.report.rows_removed
        for reason, count in result.report.removed_reasons.items():
            combined_report.removed_reasons[reason] = (
                combined_report.removed_reasons.get(reason, 0) + count
            )

    combined_report.rows_valid = len(rows)
    write_normalized_csv(output_csv_path, rows)
    return combined_report


def build_column_map(fieldnames: Iterable[str]) -> Dict[str, str]:
    column_map: Dict[str, str] = {}
    for fieldname in fieldnames:
        normalized_name = normalize_column_name(fieldname)
        target_name = COLUMN_ALIASES.get(normalized_name)
        if target_name is not None and target_name not in column_map:
            column_map[target_name] = fieldname
    return column_map


def normalize_row(
    raw_row: Dict[str, str],
    column_map: Dict[str, str],
    dataset_source: Optional[str],
) -> Dict[str, NormalizedValue]:
    normalized_row: Dict[str, NormalizedValue] = {}

    for column_name in NORMALIZED_COLUMNS:
        normalized_row[column_name] = None

    normalized_row["dataset_source"] = read_text_value(
        raw_row,
        column_map.get("dataset_source"),
        dataset_source,
    )
    normalized_row["external_animal_id"] = read_text_value(
        raw_row,
        column_map.get("external_animal_id"),
        "",
    )
    normalized_row["breed"] = read_text_value(raw_row, column_map.get("breed"), "")
    normalized_row["sex"] = read_text_value(raw_row, column_map.get("sex"), "")

    age_column = column_map.get("age_months")
    normalized_row["age_months"] = read_float_value(raw_row, age_column)

    for measurement_column in MEASUREMENT_COLUMNS:
        raw_column = column_map.get(measurement_column)
        raw_value = read_float_value(raw_row, raw_column)
        normalized_row[measurement_column] = convert_measurement_to_cm(
            raw_value,
            raw_column,
        )

    weight_column = column_map.get("real_weight_kg")
    weight_value = read_float_value(raw_row, weight_column)
    normalized_row["real_weight_kg"] = convert_weight_to_kg(
        weight_value,
        weight_column,
    )
    return normalized_row


def get_removal_reason(row: Dict[str, NormalizedValue]) -> Optional[str]:
    for required_column in ["real_weight_kg", "body_length_cm", "chest_girth_cm"]:
        value = row.get(required_column)
        if value is None or is_missing_number(value):
            return "missing_" + required_column

    for numeric_column, limits in EXTREME_VALUE_LIMITS.items():
        value = row.get(numeric_column)
        if value is None or is_missing_number(value):
            continue
        if value <= 0:
            return "non_positive_" + numeric_column
        lower_limit, upper_limit = limits
        if value < lower_limit or value > upper_limit:
            return "extreme_outlier_" + numeric_column

    return None


def format_row(row: Dict[str, NormalizedValue]) -> Dict[str, str]:
    formatted: Dict[str, str] = {}
    for column_name in NORMALIZED_COLUMNS:
        value = row.get(column_name)
        if value is None:
            formatted[column_name] = ""
        elif isinstance(value, float):
            formatted[column_name] = format_float(value)
        else:
            formatted[column_name] = str(value)
    return formatted


def write_normalized_csv(output_csv_path: Path, rows: List[Dict[str, str]]) -> None:
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    with output_csv_path.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=NORMALIZED_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def normalize_column_name(column_name: str) -> str:
    lowered = column_name.strip().lower()
    for token in [" ", "_", "-", "/", "(", ")", "[", "]", "."]:
        lowered = lowered.replace(token, "")
    for unit_suffix in [
        "cm",
        "centimeter",
        "centimeters",
        "kg",
        "kilogram",
        "kilograms",
        "mm",
        "meter",
        "meters",
        "metre",
        "metres",
        "lb",
        "lbs",
        "pound",
        "pounds",
    ]:
        if lowered.endswith(unit_suffix):
            return lowered[: -len(unit_suffix)]
    return lowered


def read_text_value(
    raw_row: Dict[str, str],
    column_name: Optional[str],
    default_value: str,
) -> str:
    if column_name is None:
        return default_value
    value = raw_row.get(column_name)
    if value is None or value.strip() == "":
        return default_value
    return value.strip()


def read_float_value(
    raw_row: Dict[str, str], column_name: Optional[str]
) -> Optional[float]:
    if column_name is None:
        return None
    raw_value = raw_row.get(column_name)
    if raw_value is None:
        return None
    cleaned_value = raw_value.strip().replace(",", ".")
    if cleaned_value == "":
        return None
    try:
        return float(cleaned_value)
    except ValueError:
        return None


def convert_measurement_to_cm(
    value: Optional[float],
    column_name: Optional[str],
) -> Optional[float]:
    if value is None:
        return None
    normalized_name = "" if column_name is None else column_name.lower()
    if "mm" in normalized_name:
        return value / 10.0
    if "meter" in normalized_name or "metre" in normalized_name:
        return value * 100.0
    if value <= 3.0:
        return value * 100.0
    if value > 500.0:
        return value / 10.0
    return value


def convert_weight_to_kg(
    value: Optional[float],
    column_name: Optional[str],
) -> Optional[float]:
    if value is None:
        return None
    normalized_name = "" if column_name is None else column_name.lower()
    if "lb" in normalized_name or "pound" in normalized_name:
        return value * 0.45359237
    return value


def is_missing_number(value: object) -> bool:
    return isinstance(value, float) and math.isnan(value)


def format_float(value: float) -> str:
    return f"{value:.6f}".rstrip("0").rstrip(".")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize an external cattle weight CSV into the PondiFarm schema.",
    )
    parser.add_argument("input_csv_path", type=Path)
    parser.add_argument("output_csv_path", type=Path)
    parser.add_argument("--dataset-source", default=None)
    args = parser.parse_args()

    result = normalize_external_dataset(
        input_csv_path=args.input_csv_path,
        output_csv_path=args.output_csv_path,
        dataset_source=args.dataset_source,
    )
    print(json.dumps(result.report.to_dict(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

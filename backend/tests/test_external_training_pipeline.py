import csv
import tempfile
import unittest
from pathlib import Path

from ml.preprocessing.external_dataset_normalizer import (
    NORMALIZED_COLUMNS,
    normalize_external_dataset,
)
from ml.training.train_weight_model import train_weight_model


class ExternalTrainingPipelineTests(unittest.TestCase):
    def test_normalizer_maps_known_columns_to_internal_format(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "raw.csv"
            output_path = Path(temp_dir) / "normalized.csv"
            self.write_csv(
                input_path,
                [
                    "animal_id",
                    "breed",
                    "sex",
                    "age_months",
                    "OBL",
                    "WH",
                    "CD",
                    "hip_joint_width",
                    "HG",
                    "WT",
                ],
                [
                    {
                        "animal_id": "cow-1",
                        "breed": "Holstein",
                        "sex": "F",
                        "age_months": "36",
                        "OBL": "1.52",
                        "WH": "132",
                        "CD": "68",
                        "hip_joint_width": "52",
                        "HG": "198",
                        "WT": "520",
                    },
                ],
            )

            result = normalize_external_dataset(input_path, output_path, "CowDatabase")

            self.assertEqual(result.report.rows_read, 1)
            self.assertEqual(result.report.rows_valid, 1)
            self.assertEqual(result.rows[0]["dataset_source"], "CowDatabase")
            self.assertEqual(result.rows[0]["external_animal_id"], "cow-1")
            self.assertEqual(result.rows[0]["body_length_cm"], "152")
            self.assertEqual(result.rows[0]["chest_girth_cm"], "198")
            self.assertEqual(result.rows[0]["real_weight_kg"], "520")
            self.assertTrue(output_path.exists())

    def test_normalizer_maps_measurements_workbook_headers(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "measurements.csv"
            self.write_csv(
                input_path,
                [
                    "N",
                    "live weithg",
                    "withers height",
                    "hip height",
                    "chest depth",
                    "chest width",
                    "ilium width",
                    "hip joint width",
                    "oblique body length",
                    "hip length",
                    "heart girth",
                ],
                [
                    {
                        "N": "1",
                        "live weithg": "415",
                        "withers height": "117",
                        "hip height": "122",
                        "chest depth": "62",
                        "chest width": "40",
                        "ilium width": "43",
                        "hip joint width": "42",
                        "oblique body length": "145",
                        "hip length": "43",
                        "heart girth": "172",
                    },
                ],
            )

            result = normalize_external_dataset(
                input_path, dataset_source="Measurements"
            )

            self.assertEqual(result.report.rows_valid, 1)
            self.assertEqual(result.rows[0]["external_animal_id"], "1")
            self.assertEqual(result.rows[0]["real_weight_kg"], "415")
            self.assertEqual(result.rows[0]["withers_height_cm"], "117")
            self.assertEqual(result.rows[0]["thoracic_depth_cm"], "62")
            self.assertEqual(result.rows[0]["rump_width_cm"], "43")
            self.assertEqual(result.rows[0]["body_length_cm"], "145")
            self.assertEqual(result.rows[0]["chest_girth_cm"], "172")

    def test_normalizer_flags_rows_without_body_length(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "database.csv"
            self.write_csv(
                input_path,
                [
                    "N",
                    "Tag number",
                    "Birthday",
                    "Live weigth",
                    "Withers height",
                    "Hip height",
                    "Chest width",
                    "Chest heart",
                ],
                [
                    {
                        "N": "1",
                        "Tag number": "2072371",
                        "Birthday": "02.06.2020",
                        "Live weigth": "633",
                        "Withers height": "123",
                        "Hip height": "122",
                        "Chest width": "53",
                        "Chest heart": "214",
                    },
                ],
            )

            result = normalize_external_dataset(input_path, dataset_source="Database")

            self.assertEqual(result.report.rows_valid, 0)
            self.assertEqual(result.report.removed_reasons["missing_body_length_cm"], 1)

    def test_normalizer_removes_rows_without_real_weight(self):
        result = self.normalize_single_invalid_row(
            {"body_length_cm": "150", "chest_girth_cm": "190"}
        )

        self.assertEqual(result.report.rows_valid, 0)
        self.assertEqual(result.report.removed_reasons["missing_real_weight_kg"], 1)

    def test_normalizer_removes_rows_without_body_length(self):
        result = self.normalize_single_invalid_row(
            {"chest_girth_cm": "190", "real_weight_kg": "520"}
        )

        self.assertEqual(result.report.rows_valid, 0)
        self.assertEqual(result.report.removed_reasons["missing_body_length_cm"], 1)

    def test_normalizer_removes_rows_without_chest_girth(self):
        result = self.normalize_single_invalid_row(
            {"body_length_cm": "150", "real_weight_kg": "520"}
        )

        self.assertEqual(result.report.rows_valid, 0)
        self.assertEqual(result.report.removed_reasons["missing_chest_girth_cm"], 1)

    def test_training_generates_joblib_and_metadata_with_metrics(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            normalized_path = Path(temp_dir) / "normalized.csv"
            model_path = Path(temp_dir) / "external-trained-v0.1.0.joblib"
            metadata_path = Path(temp_dir) / "external-trained-v0.1.0.metadata.json"
            self.write_normalized_training_csv(normalized_path)

            metadata = train_weight_model(normalized_path, model_path, metadata_path)

            self.assertTrue(model_path.exists())
            self.assertTrue(metadata_path.exists())
            self.assertEqual(metadata["model_version"], "external-trained-v0.1.0")
            self.assertIn("mae", metadata["metrics"])
            self.assertIn("rmse", metadata["metrics"])
            self.assertIn("mape", metadata["metrics"])
            self.assertIn("r2", metadata["metrics"])
            self.assertTrue(metadata["is_external_dataset_model"])
            self.assertFalse(metadata["is_farm_calibrated_model"])

    def test_training_requires_minimum_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            normalized_path = Path(temp_dir) / "tiny.csv"
            self.write_csv(
                normalized_path,
                NORMALIZED_COLUMNS,
                [
                    {
                        "dataset_source": "synthetic-test",
                        "external_animal_id": "a-1",
                        "breed": "test",
                        "sex": "F",
                        "age_months": "24",
                        "body_length_cm": "150",
                        "withers_height_cm": "130",
                        "thoracic_depth_cm": "70",
                        "rump_width_cm": "50",
                        "chest_girth_cm": "190",
                        "real_weight_kg": "500",
                    },
                ],
            )

            with self.assertRaises(ValueError):
                train_weight_model(
                    normalized_path,
                    Path(temp_dir) / "model.joblib",
                    Path(temp_dir) / "model.metadata.json",
                )

    def normalize_single_invalid_row(self, row):
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "raw.csv"
            self.write_csv(input_path, NORMALIZED_COLUMNS, [row])
            return normalize_external_dataset(input_path, dataset_source="test")

    def write_normalized_training_csv(self, path):
        rows = []
        for index in range(12):
            body_length = 140 + index * 2
            withers_height = 125 + index
            thoracic_depth = 62 + index * 0.5
            rump_width = 48 + index * 0.3
            chest_girth = 180 + index * 3
            real_weight = 0.11 * chest_girth * chest_girth * body_length / 100 + 80
            rows.append(
                {
                    "dataset_source": "synthetic-test",
                    "external_animal_id": f"animal-{index}",
                    "breed": "test",
                    "sex": "F",
                    "age_months": str(24 + index),
                    "body_length_cm": str(body_length),
                    "withers_height_cm": str(withers_height),
                    "thoracic_depth_cm": str(thoracic_depth),
                    "rump_width_cm": str(rump_width),
                    "chest_girth_cm": str(chest_girth),
                    "real_weight_kg": f"{real_weight:.2f}",
                },
            )
        self.write_csv(path, NORMALIZED_COLUMNS, rows)

    def write_csv(self, path, fieldnames, rows):
        with path.open("w", encoding="utf-8", newline="") as output_file:
            writer = csv.DictWriter(output_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)


if __name__ == "__main__":
    unittest.main()

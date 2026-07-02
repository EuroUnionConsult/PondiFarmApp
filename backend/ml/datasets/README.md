# External training datasets

This directory is the manual staging area for external cattle weight datasets.

Do not download datasets automatically from application code. Before using a
dataset, review its licence, citation requirements, column meanings, units, and
whether the target value is real measured weight rather than a previous
estimate.

Expected workflow:

1. Place reviewed raw files under `backend/ml/datasets/external/`.
2. Normalize each dataset into the internal CSV format under
   `backend/ml/datasets/processed/`.
3. Train offline with `backend/ml/training/train_weight_model.py`.
4. Review metrics and metadata before enabling the trained model.

Minimum normalized CSV columns:

```csv
dataset_source,external_animal_id,breed,sex,age_months,body_length_cm,withers_height_cm,thoracic_depth_cm,rump_width_cm,chest_girth_cm,real_weight_kg
```

Large raw datasets and generated processed datasets should not be committed.

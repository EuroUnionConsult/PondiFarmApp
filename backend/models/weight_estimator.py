import numpy as np
import os
import pickle
from typing import Tuple
from sklearn.ensemble import RandomForestRegressor

MODEL_PATH = os.path.join(os.path.dirname(__file__), "rf_model.pkl")


def _generate_synthetic_dataset(n=600):
    """Dataset sintético baseado em valores da literatura (Ruchay 2022, Nilchuen 2025)."""
    np.random.seed(42)
    body_length = np.random.normal(148, 10, n)
    withers_height = np.random.normal(130, 8, n)
    thoracic_depth = np.random.normal(68, 5, n)
    rump_width = np.random.normal(51, 4, n)
    chest_girth = np.random.normal(198, 12, n)

    # Fórmula empírica baseada na literatura + ruído realista
    weight = (
        2.1 * body_length
        + 1.8 * withers_height
        + 2.4 * thoracic_depth
        + 1.6 * rump_width
        + 0.9 * chest_girth
        - 620
        + np.random.normal(0, 12, n)
    )
    weight = np.clip(weight, 200, 800)

    X = np.column_stack(
        [body_length, withers_height, thoracic_depth, rump_width, chest_girth]
    )
    return X, weight


def train_and_save():
    X, y = _generate_synthetic_dataset()
    model = RandomForestRegressor(n_estimators=300, max_depth=12, random_state=42)
    model.fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"Modelo treinado e salvo em {MODEL_PATH}")
    return model


def load_model():
    if not os.path.exists(MODEL_PATH):
        print("Modelo não encontrado — treinando modelo placeholder...")
        return train_and_save()
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def estimate_weight(measurements: dict) -> Tuple[float, float]:
    """Retorna (peso_kg, confianca_0_a_1)."""
    model = load_model()
    X = np.array(
        [
            [
                measurements["body_length_cm"],
                measurements["withers_height_cm"],
                measurements["thoracic_depth_cm"],
                measurements["rump_width_cm"],
                measurements["chest_girth_cm"],
            ]
        ]
    )
    predictions = np.array([tree.predict(X)[0] for tree in model.estimators_])
    peso = float(np.mean(predictions))
    std = float(np.std(predictions))
    confianca = float(max(0.70, min(0.96, 1 - (std / peso))))
    return round(peso, 1), round(confianca * 100, 1)

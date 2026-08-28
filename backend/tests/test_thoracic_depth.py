"""Profundidade torácica como coluna de primeira classe (M1).

O device já calcula a medida (``MeshMeasurer.thoracicDepth``) e o modelo
on-device já a usa como 3ª feature, mas ela só viajava dentro de
``raw_result_json`` — um blob que o SQL não consulta e do qual não se treina.
Estes testes fixam o comportamento novo:

1. a coluna existe no esquema criado de raiz;
2. a migração aditiva cria a coluna numa base já existente, sem tocar em dados;
3. o predictor recebe a medida real em vez da constante de 65 cm;
4. scans anteriores à coluna (NULL) continuam a estimar peso via fallback.

Nota: este módulo é auto-contido de propósito. ``tests/test_scan_weight_estimation``
faz chamadas HTTP e está desatualizado desde a varredura de auth (devolve 401);
a CI de backend só corre ruff + smoke de import, por isso essa regressão passou
despercebida.
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from sqlalchemy import Float, create_engine, inspect, text  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from core.database import Base, ensure_schema_compatibility  # noqa: E402
from models.models import AnimalScan  # noqa: E402
from services.scan_service import (  # noqa: E402
    _MEASUREMENT_FALLBACKS,
    OPTIONAL_ESTIMATION_COLUMNS,
    _build_prediction_request,
)


def _memory_engine():
    return create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


class ThoracicDepthColumnTests(unittest.TestCase):
    def test_column_is_part_of_the_orm_model(self):
        column = AnimalScan.__table__.columns["thoracic_depth"]

        self.assertIsInstance(column.type, Float)
        self.assertTrue(column.nullable, "scans antigos têm de poder ficar NULL")

    def test_fresh_schema_has_the_column(self):
        engine = _memory_engine()
        Base.metadata.create_all(bind=engine)

        columns = {c["name"] for c in inspect(engine).get_columns("animal_scans")}

        self.assertIn("thoracic_depth", columns)

    def test_migration_adds_the_column_to_a_legacy_table_without_losing_rows(self):
        """Simula o Azure SQL em produção: tabela criada antes da coluna existir."""
        engine = _memory_engine()
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE animal_scans (
                        id VARCHAR(36) PRIMARY KEY,
                        scan_status VARCHAR(50),
                        chest_circumference FLOAT
                    )
                    """,
                ),
            )
            connection.execute(
                text(
                    "INSERT INTO animal_scans (id, scan_status, chest_circumference)"
                    " VALUES ('legacy-1', 'completed', 194.3)",
                ),
            )

        ensure_schema_compatibility(engine)

        columns = {c["name"] for c in inspect(engine).get_columns("animal_scans")}
        self.assertIn("thoracic_depth", columns)

        with engine.begin() as connection:
            row = connection.execute(
                text(
                    "SELECT chest_circumference, thoracic_depth FROM animal_scans"
                    " WHERE id = 'legacy-1'",
                ),
            ).one()
        self.assertEqual(row[0], 194.3)
        self.assertIsNone(row[1], "linha antiga não pode ganhar um valor inventado")

    def test_migration_is_idempotent(self):
        engine = _memory_engine()
        Base.metadata.create_all(bind=engine)

        ensure_schema_compatibility(engine)
        ensure_schema_compatibility(engine)  # não pode levantar

        columns = [c["name"] for c in inspect(engine).get_columns("animal_scans")]
        self.assertEqual(columns.count("thoracic_depth"), 1)


class ThoracicDepthPredictionTests(unittest.TestCase):
    @staticmethod
    def _scan(thoracic_depth):
        return AnimalScan(
            scan_status="completed",
            body_length=152.4,
            withers_height=126.8,
            chest_circumference=194.3,
            hip_width=50.2,
            thoracic_depth=thoracic_depth,
        )

    def test_real_measurement_reaches_the_predictor(self):
        request = _build_prediction_request(self._scan(71.4))

        self.assertEqual(request.measurements.thoracic_depth_cm, 71.4)

    def test_measurement_is_not_silently_replaced_by_the_constant(self):
        """Regressão: o serviço enviava sempre 65.0 cm, ignorando o scanner."""
        request = _build_prediction_request(self._scan(58.0))

        self.assertNotEqual(
            request.measurements.thoracic_depth_cm,
            _MEASUREMENT_FALLBACKS["thoracic_depth_cm"],
        )

    def test_scan_predating_the_column_falls_back(self):
        request = _build_prediction_request(self._scan(None))

        self.assertEqual(
            request.measurements.thoracic_depth_cm,
            _MEASUREMENT_FALLBACKS["thoracic_depth_cm"],
        )

    def test_column_is_validated_as_an_optional_measurement(self):
        """Um valor <= 0 tem de ser rejeitado, não passar como medida boa."""
        self.assertIn("thoracic_depth", OPTIONAL_ESTIMATION_COLUMNS)


if __name__ == "__main__":
    unittest.main()

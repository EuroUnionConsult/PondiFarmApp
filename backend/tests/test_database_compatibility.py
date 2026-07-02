import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from core.database import ensure_schema_compatibility


class DatabaseCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE species (
                        id CHAR(36) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        created_at DATETIME,
                        updated_at DATETIME,
                        deleted_at DATETIME
                    )
                    """,
                ),
            )
            connection.execute(
                text(
                    """
                    CREATE TABLE breeds (
                        id CHAR(36) PRIMARY KEY,
                        species_id CHAR(36) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        created_at DATETIME,
                        updated_at DATETIME,
                        deleted_at DATETIME
                    )
                    """,
                ),
            )
            connection.execute(
                text(
                    """
                    INSERT INTO species (id, name)
                    VALUES ('00000000-0000-0000-0000-000000000001', '  Bovine  ')
                    """,
                ),
            )
            connection.execute(
                text(
                    """
                    INSERT INTO breeds (id, species_id, name)
                    VALUES (
                        '00000000-0000-0000-0000-000000000002',
                        '00000000-0000-0000-0000-000000000001',
                        '  Angus  '
                    )
                    """,
                ),
            )

    def tearDown(self):
        self.engine.dispose()

    def test_ensure_schema_compatibility_adds_and_backfills_normalized_names(self):
        ensure_schema_compatibility(self.engine)
        ensure_schema_compatibility(self.engine)

        inspector = inspect(self.engine)
        self.assertIn(
            "normalized_name",
            {column["name"] for column in inspector.get_columns("species")},
        )
        self.assertIn(
            "normalized_name",
            {column["name"] for column in inspector.get_columns("breeds")},
        )

        with self.engine.connect() as connection:
            species_normalized_name = connection.execute(
                text("SELECT normalized_name FROM species"),
            ).scalar_one()
            breed_normalized_name = connection.execute(
                text("SELECT normalized_name FROM breeds"),
            ).scalar_one()

        self.assertEqual(species_normalized_name, "bovine")
        self.assertEqual(breed_normalized_name, "angus")


if __name__ == "__main__":
    unittest.main()

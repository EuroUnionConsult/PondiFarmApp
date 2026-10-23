"""As consultas aos scans têm de ser SQL válido no SQL Server (Azure SQL).

Os testes correm em SQLite, que aceita coisas que o SQL Server recusa. A 23/10/2026
um EXISTS na lista do SELECT passou em todos os testes e partiu a produção.
Aqui compila-se para o dialeto mssql e procura-se o padrão proibido.
"""

import os
import re
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from sqlalchemy import select  # noqa: E402
from sqlalchemy.dialects import mssql  # noqa: E402

from models.models import AnimalScan  # noqa: E402


def _mssql(stmt) -> str:
    return str(stmt.compile(dialect=mssql.dialect()))


class MssqlCompatibilityTests(unittest.TestCase):
    def test_scan_select_has_no_bare_exists_column(self):
        sql = _mssql(select(AnimalScan))
        # EXISTS só é válido dentro de WHERE/CASE; a seguir a «SELECT ...,» é erro no SQL Server.
        self.assertNotRegex(sql, re.compile(r",\s*EXISTS\s*\(", re.IGNORECASE))
        self.assertIn("CASE WHEN", sql.upper())

    def test_has_mesh_is_a_case_expression(self):
        sql = _mssql(select(AnimalScan.has_mesh))
        self.assertRegex(sql.upper(), r"^SELECT CASE WHEN \(?EXISTS")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy.engine import URL


@dataclass(frozen=True)
class Settings:
    database_url: str


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def _build_database_url() -> str:
    _load_env_file()

    direct_url = os.getenv("DATABASE_URL")
    if direct_url:
        return direct_url

    server = os.getenv("AZURE_SQL_SERVER")
    database = os.getenv("AZURE_SQL_DATABASE")
    username = os.getenv("AZURE_SQL_USERNAME")
    password = os.getenv("AZURE_SQL_PASSWORD")
    driver = os.getenv("AZURE_SQL_DRIVER", "ODBC Driver 18 for SQL Server")
    encrypt = os.getenv("AZURE_SQL_ENCRYPT", "yes")
    trust_certificate = os.getenv("AZURE_SQL_TRUST_SERVER_CERTIFICATE", "no")

    required_values = {
        "AZURE_SQL_SERVER": server,
        "AZURE_SQL_DATABASE": database,
        "AZURE_SQL_USERNAME": username,
        "AZURE_SQL_PASSWORD": password,
    }
    missing = [key for key, value in required_values.items() if not value]
    if missing:
        missing_str = ", ".join(missing)
        raise RuntimeError(
            "Database configuration is missing. Set DATABASE_URL or the Azure SQL "
            f"variables: {missing_str}.",
        )

    odbc_connection_string = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},1433;"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust_certificate};"
        "Connection Timeout=10;"
    )
    return URL.create(
        "mssql+pyodbc",
        query={"odbc_connect": quote_plus(odbc_connection_string)},
    ).render_as_string(hide_password=False)


settings = Settings(database_url=_build_database_url())

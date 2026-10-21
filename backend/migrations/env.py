"""Ambiente do Alembic. A URL vem de core.config, a mesma que a API usa; um
`-x url=...` na linha de comando tem prioridade (útil para testes)."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from core.config import get_settings
from core.database import Base
import models.models  # noqa: F401  (regista as tabelas no metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _url() -> str:
    return (
        context.get_x_argument(as_dictionary=True).get("url")
        or get_settings().database_url
    )


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _entra_connect_args() -> dict:
    """`-x entra=1`: autentica no Azure SQL com a sessão do `az login` (token
    Entra), sem usar nem copiar a senha SQL da API. O URL tem de ser uma
    ligação ODBC SEM utilizador (com «mssql+pyodbc://@host/db» o SQLAlchemy
    junta Trusted_Connection e o driver recusa o token). Usado a 21/10/2026:
      odbc = quote_plus("DRIVER={ODBC Driver 18 for SQL Server};"
                        "SERVER=tcp:pondifarm.database.windows.net,1433;"
                        "DATABASE=free-sql-db-8156065;Encrypt=yes;")
      alembic -x entra=1 -x url="mssql+pyodbc:///?odbc_connect=<odbc>" upgrade head
    """
    import struct
    import subprocess

    token = subprocess.run(
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            "https://database.windows.net/",
            "--query",
            "accessToken",
            "-o",
            "tsv",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    raw = token.encode("utf-16-le")
    SQL_COPT_SS_ACCESS_TOKEN = 1256  # atributo do driver ODBC da Microsoft
    return {
        "attrs_before": {
            SQL_COPT_SS_ACCESS_TOKEN: struct.pack(f"<I{len(raw)}s", len(raw), raw)
        }
    }


def run_migrations_online() -> None:
    use_entra = context.get_x_argument(as_dictionary=True).get("entra") == "1"
    engine = create_engine(
        _url(),
        poolclass=pool.NullPool,
        future=True,
        connect_args=_entra_connect_args() if use_entra else {},
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

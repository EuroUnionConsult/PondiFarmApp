from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from core.config import get_settings

Base = declarative_base()
_engine: Engine | None = None
_session_local: sessionmaker | None = None
EXTERNALLY_MANAGED_TABLES = {"animal_documents"}


def _create_engine() -> Engine:
    settings = get_settings()
    connect_args = {}
    engine_kwargs: dict = {"future": True}
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        # Resiliência p/ Azure SQL free-tier (auto-pausa quando ocioso):
        # pre-ping descarta conexões mortas e reconecta; timeout de login maior
        # dá tempo do DB acordar (~30-60s) na primeira query após a pausa.
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 1800
        connect_args["timeout"] = 60

    engine = create_engine(
        settings.database_url,
        connect_args=connect_args,
        **engine_kwargs,
    )

    if settings.database_url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)

    return engine


def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _normalized_name_expression(column_name: str, dialect_name: str) -> str:
    if dialect_name == "mssql":
        return f"LOWER(LTRIM(RTRIM({column_name})))"
    return f"LOWER(TRIM({column_name}))"


def _ensure_normalized_name_column(
    connection: Connection,
    table_name: str,
    source_column: str = "name",
) -> None:
    inspector = inspect(connection)
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if "normalized_name" not in existing_columns:
        connection.execute(
            text(f"ALTER TABLE {table_name} ADD normalized_name VARCHAR(255)"),
        )

    normalized_name_expression = _normalized_name_expression(
        source_column,
        connection.dialect.name,
    )
    connection.execute(
        text(
            f"""
            UPDATE {table_name}
            SET normalized_name = {normalized_name_expression}
            WHERE normalized_name IS NULL OR normalized_name = ''
            """,
        ),
    )


def ensure_schema_compatibility(bind: Engine) -> None:
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    if "species" not in table_names and "breeds" not in table_names:
        return

    with bind.begin() as connection:
        if "species" in table_names:
            _ensure_normalized_name_column(connection, "species")
        if "breeds" in table_names:
            _ensure_normalized_name_column(connection, "breeds")


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def get_session_local() -> sessionmaker:
    global _session_local
    if _session_local is None:
        _session_local = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            future=True,
        )
    return _session_local


def get_db() -> Generator[Session, None, None]:
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()


def initialize_database() -> None:
    import models.models  # noqa: F401

    engine = get_engine()
    bootstrap_tables = [
        table
        for table in Base.metadata.sorted_tables
        if table.name not in EXTERNALLY_MANAGED_TABLES
    ]
    Base.metadata.create_all(bind=engine, tables=bootstrap_tables)
    ensure_schema_compatibility(engine)

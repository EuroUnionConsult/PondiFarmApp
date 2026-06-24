from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from core.config import get_settings

Base = declarative_base()
_engine: Engine | None = None
_session_local: sessionmaker | None = None


def _create_engine() -> Engine:
    settings = get_settings()
    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(
        settings.database_url,
        future=True,
        connect_args=connect_args,
    )

    if settings.database_url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)

    return engine


def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


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

    get_engine()

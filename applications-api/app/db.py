"""Database access: engine, session dependency, startup retry and migrations.

Rules for everyone working on this service:

- Only `app/repositories/` runs SQL. Routes and services receive a `Session`.
- The schema changes only through a new file in `migrations/versions/`.
- Nothing here logs the connection string or any credential.
"""

import logging
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import HTTPException, Request
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings

BASE_DIR = Path(__file__).resolve().parent.parent

logger = logging.getLogger("app.db")


class DatabaseUnavailableError(RuntimeError):
    """The database did not accept connections before the wait time ran out."""


def _ensure_logging_to_stdout() -> None:
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not any(getattr(h, "_app_stdout", False) for h in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        handler._app_stdout = True  # type: ignore[attr-defined]
        logger.addHandler(handler)


def build_engine(url: str) -> Engine:
    # pool_pre_ping drops connections that went stale while the database was paused.
    return create_engine(url, pool_pre_ping=True)


def connect_with_retry(
    engine: Engine,
    *,
    max_wait_seconds: float = 90.0,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> int:
    """Wait until the database accepts a connection. Returns the attempts used.

    Azure SQL serverless pauses when idle and can take about a minute to resume,
    during which connections fail. We retry with a growing delay until
    `max_wait_seconds` has passed, then give up with a clear error.
    """
    _ensure_logging_to_stdout()
    deadline = monotonic() + max_wait_seconds
    delay = initial_delay
    attempt = 0
    while True:
        attempt += 1
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return attempt
        except DBAPIError as exc:
            remaining = deadline - monotonic()
            reason = type(exc.orig).__name__ if exc.orig is not None else type(exc).__name__
            if remaining <= 0:
                logger.error("database not reachable after %s attempts (%s)", attempt, reason)
                raise DatabaseUnavailableError(
                    f"Database did not become available within {max_wait_seconds:g} seconds"
                ) from exc
            pause = min(delay, remaining)
            logger.warning(
                "database not ready (attempt %s, %s); retrying in %.1fs", attempt, reason, pause
            )
            sleep(pause)
            delay = min(delay * 2, max_delay)


def run_migrations(engine: Engine) -> None:
    """Apply every migration up to head. Safe to run on every startup."""
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "migrations"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def initialise_database(settings: Settings) -> Engine | None:
    """Connect (with retry) and migrate, according to the settings.

    Returns None when no database is configured and migrations are off, which
    lets the app start for health checks and tests.
    """
    secret = settings.applications_db_url
    if secret is None:
        if settings.run_migrations_on_startup:
            raise RuntimeError(
                "APPLICATIONS_DB_URL is required when RUN_MIGRATIONS_ON_STARTUP is true"
            )
        return None

    engine = build_engine(secret.get_secret_value())
    connect_with_retry(engine, max_wait_seconds=settings.db_connect_max_wait_seconds)
    if settings.run_migrations_on_startup:
        run_migrations(engine)
        logger.info("migrations applied")
    return engine


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed afterwards."""
    factory: sessionmaker[Session] | None = request.app.state.session_factory
    if factory is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    with factory() as session:
        yield session

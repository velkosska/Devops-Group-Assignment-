import logging
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import DatabaseUnavailableError, connect_with_retry, get_session
from app.main import create_app


class FlakyEngine:
    """Fails to connect a fixed number of times, then works like a real engine."""

    def __init__(self, failures: int, real_engine: Engine) -> None:
        self.failures = failures
        self.real_engine = real_engine
        self.calls = 0

    def connect(self):
        self.calls += 1
        if self.calls <= self.failures:
            raise OperationalError("SELECT 1", {}, Exception("Database is not currently available"))
        return self.real_engine.connect()


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class ListHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(record.getMessage())


@pytest.fixture
def db_log_lines() -> Iterator[list[str]]:
    handler = ListHandler()
    logger = logging.getLogger("app.db")
    logger.addHandler(handler)
    yield handler.lines
    logger.removeHandler(handler)


@pytest.fixture
def real_engine(tmp_path: Path) -> Iterator[Engine]:
    engine = create_engine(f"sqlite:///{tmp_path / 'retry.db'}")
    yield engine
    engine.dispose()


def test_connects_first_time_without_sleeping(real_engine: Engine) -> None:
    clock = FakeClock()

    attempts = connect_with_retry(
        real_engine, sleep=clock.sleep, monotonic=clock.monotonic, max_wait_seconds=30
    )

    assert attempts == 1
    assert clock.sleeps == []


def test_retries_with_growing_delay_until_database_wakes_up(real_engine: Engine) -> None:
    clock = FakeClock()
    engine = FlakyEngine(failures=4, real_engine=real_engine)

    attempts = connect_with_retry(
        engine,  # type: ignore[arg-type]
        sleep=clock.sleep,
        monotonic=clock.monotonic,
        max_wait_seconds=90,
        initial_delay=1,
        max_delay=5,
    )

    assert attempts == 5
    assert clock.sleeps == [1, 2, 4, 5]


def test_gives_up_with_clear_error_after_the_wait_time(real_engine: Engine) -> None:
    clock = FakeClock()
    engine = FlakyEngine(failures=10_000, real_engine=real_engine)

    with pytest.raises(DatabaseUnavailableError) as raised:
        connect_with_retry(
            engine,  # type: ignore[arg-type]
            sleep=clock.sleep,
            monotonic=clock.monotonic,
            max_wait_seconds=20,
            initial_delay=1,
            max_delay=10,
        )

    assert "within 20 seconds" in str(raised.value)
    assert clock.now == pytest.approx(20)


def test_retry_log_never_contains_the_connection_string(
    real_engine: Engine, db_log_lines: list[str]
) -> None:
    clock = FakeClock()
    engine = FlakyEngine(failures=1, real_engine=real_engine)

    connect_with_retry(
        engine,  # type: ignore[arg-type]
        sleep=clock.sleep,
        monotonic=clock.monotonic,
    )

    assert len(db_log_lines) == 1
    assert "database not ready" in db_log_lines[0]
    assert "sqlite" not in db_log_lines[0]


def test_get_session_is_503_when_no_database_is_configured() -> None:
    app = create_app(Settings(_env_file=None, run_migrations_on_startup=False))

    @app.get("/probe")
    def probe(session: Session = Depends(get_session)) -> dict[str, str]:
        return {"ok": "yes"}

    response = TestClient(app).get("/probe")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not configured"}


def test_get_session_yields_a_working_session_after_startup_migrations(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'session.db'}"
    app = create_app(Settings(_env_file=None, applications_db_url=url))

    @app.get("/probe")
    def probe(session: Session = Depends(get_session)) -> dict[str, int]:
        count = session.execute(text("SELECT COUNT(*) FROM applications")).scalar_one()
        return {"count": count}

    with TestClient(app) as client:
        response = client.get("/probe")

    assert response.status_code == 200
    assert response.json() == {"count": 0}

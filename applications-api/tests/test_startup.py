from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from app.config import Settings
from app.db import DatabaseUnavailableError
from app.main import create_app


def table_names(db_file: Path) -> list[str]:
    engine = create_engine(f"sqlite:///{db_file}")
    try:
        return inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_startup_applies_migrations_to_the_configured_database(tmp_path: Path) -> None:
    db_file = tmp_path / "startup.db"
    settings = Settings(_env_file=None, applications_db_url=f"sqlite:///{db_file}")

    with TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200

    assert "applications" in table_names(db_file)


def test_startup_can_skip_migrations(tmp_path: Path) -> None:
    db_file = tmp_path / "skipped.db"
    settings = Settings(
        _env_file=None,
        applications_db_url=f"sqlite:///{db_file}",
        run_migrations_on_startup=False,
    )

    with TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200

    assert "applications" not in table_names(db_file)


def test_startup_without_database_url_fails_clearly_when_migrations_are_on() -> None:
    settings = Settings(_env_file=None)

    with pytest.raises(RuntimeError, match="APPLICATIONS_DB_URL is required"):
        with TestClient(create_app(settings)):
            pass


def test_startup_without_database_url_is_fine_when_migrations_are_off() -> None:
    settings = Settings(_env_file=None, run_migrations_on_startup=False)

    with TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200


def test_startup_fails_clearly_when_the_database_never_becomes_reachable(
    tmp_path: Path,
) -> None:
    unreachable = tmp_path / "missing-dir" / "x.db"
    settings = Settings(
        _env_file=None,
        applications_db_url=f"sqlite:///{unreachable}",
        db_connect_max_wait_seconds=0,
    )

    with pytest.raises(DatabaseUnavailableError):
        with TestClient(create_app(settings)):
            pass

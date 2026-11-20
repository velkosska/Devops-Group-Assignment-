import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.db import BASE_DIR, run_migrations


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    engine = create_engine(f"sqlite:///{tmp_path / 'applications.db'}")
    yield engine
    engine.dispose()


def alembic_config() -> Config:
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "migrations"))
    return config


def test_upgrade_creates_applications_table_with_expected_columns(engine: Engine) -> None:
    run_migrations(engine)

    columns = {c["name"]: c for c in inspect(engine).get_columns("applications")}
    assert list(columns) == [
        "id",
        "company",
        "role",
        "url",
        "stage",
        "location",
        "salary_range",
        "applied_at",
        "created_at",
        "updated_at",
    ]
    assert columns["company"]["nullable"] is False
    assert columns["role"]["nullable"] is False
    assert columns["url"]["nullable"] is True
    assert columns["stage"]["nullable"] is False


def test_running_migrations_twice_is_safe(engine: Engine) -> None:
    run_migrations(engine)
    run_migrations(engine)

    with engine.connect() as connection:
        versions = connection.execute(text("SELECT version_num FROM alembic_version")).all()
    assert [row[0] for row in versions] == ["0001"]


def test_defaults_stage_applied_and_timestamps(engine: Engine) -> None:
    run_migrations(engine)

    with engine.begin() as connection:
        connection.execute(text("INSERT INTO applications (company, role) VALUES ('Acme', 'Dev')"))
        row = connection.execute(
            text("SELECT stage, created_at, updated_at FROM applications")
        ).one()

    assert row.stage == "applied"
    assert row.created_at is not None
    assert row.updated_at is not None


def test_database_rejects_unknown_stage(engine: Engine) -> None:
    run_migrations(engine)

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text("INSERT INTO applications (company, role, stage) VALUES ('Acme', 'Dev', 'hired')")
        )


def test_database_requires_company_and_role(engine: Engine) -> None:
    run_migrations(engine)

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("INSERT INTO applications (company) VALUES ('Acme')"))


def test_downgrade_removes_the_table(engine: Engine) -> None:
    run_migrations(engine)

    with engine.begin() as connection:
        config = alembic_config()
        config.attributes["connection"] = connection
        command.downgrade(config, "base")

    assert "applications" not in inspect(engine).get_table_names()


def test_sql_server_script_uses_sql_server_types() -> None:
    """Generate the SQL for Azure SQL without a database and check the key parts."""
    config = alembic_config()
    config.attributes["url"] = "mssql+pyodbc://user:pw@localhost/db"
    buffer = io.StringIO()
    config.output_buffer = buffer

    command.upgrade(config, "head", sql=True)

    script = buffer.getvalue()
    assert "CREATE TABLE applications" in script
    assert "IDENTITY" in script
    assert "DATETIMEOFFSET" in script
    assert "CONSTRAINT ck_applications_stage CHECK" in script
    assert "CREATE INDEX ix_applications_stage" in script

"""Service and SQL repository tests.

SQLite runs the real repository against migration 0001. It does not prove
Azure SQL. The SQL Server script is checked, without a server, in
test_migrations.py.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import run_migrations
from app.domain.applications import (
    COMPANY_MAX_LENGTH,
    LOCATION_MAX_LENGTH,
    ROLE_MAX_LENGTH,
    SALARY_RANGE_MAX_LENGTH,
    URL_MAX_LENGTH,
    ApplicationError,
)
from app.domain.stages import Stage
from app.repositories.applications import SqlApplicationRepository
from app.services.applications import ApplicationNotFound, ApplicationService


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 21, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        current = self.now
        self.now += timedelta(minutes=1)
        return current


@pytest.fixture
def service(tmp_path: Path) -> Iterator[ApplicationService]:
    engine = create_engine(f"sqlite:///{tmp_path / 'applications.db'}")
    run_migrations(engine)
    session: Session = sessionmaker(engine)()
    yield ApplicationService(SqlApplicationRepository(session, clock=Clock()))
    session.close()
    engine.dispose()


def test_spotify_can_be_saved_listed_renamed_moved_and_deleted(
    service: ApplicationService,
) -> None:
    created = service.create(
        "  Spotify  ",
        " Data Engineer ",
        url="  https://jobs.example  ",
        applied_at=datetime(2026, 11, 1, 9, 0),
    )

    assert created.id == 1
    assert created.company == "Spotify"
    assert created.role == "Data Engineer"
    assert created.stage is Stage.APPLIED
    assert created.url == "https://jobs.example"
    assert created.applied_at == datetime(2026, 11, 1, 9, 0, tzinfo=UTC)
    assert created.created_at == datetime(2026, 11, 21, 12, 0, tzinfo=UTC)
    assert service.get(created.id).role == "Data Engineer"

    service.create(
        "Acme",
        "Designer",
        stage="interview",
        applied_at=datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
    )
    assert [item.company for item in service.list_applications()] == ["Spotify", "Acme"]
    assert [item.company for item in service.list_applications(stage="applied")] == ["Spotify"]
    assert service.list_applications(stage=Stage.SCREEN) == []

    renamed = service.update(created.id, company="Spotify", role="Backend Engineer")
    assert renamed.role == "Backend Engineer"
    assert renamed.stage is Stage.APPLIED
    assert renamed.updated_at > renamed.created_at

    moved = service.change_stage(created.id, "screen")
    assert moved.stage is Stage.SCREEN

    service.delete(created.id)
    assert [item.company for item in service.list_applications()] == ["Acme"]
    with pytest.raises(ApplicationNotFound, match="was not found"):
        service.get(created.id)


def test_a_blank_company_does_not_change_the_saved_row(service: ApplicationService) -> None:
    created = service.create("Spotify", "Data Engineer")

    with pytest.raises(ApplicationError, match="company is required"):
        service.update(created.id, company="   ", role="Data Engineer")

    assert service.get(created.id).company == "Spotify"


def test_moving_to_the_current_stage_does_not_save(service: ApplicationService) -> None:
    created = service.create("Spotify", "Data Engineer")

    with pytest.raises(ApplicationError, match="different stage"):
        service.change_stage(created.id, "applied")

    assert service.get(created.id).stage is Stage.APPLIED


@pytest.mark.parametrize("application_id", [0, 999])
def test_missing_application_is_not_found(service: ApplicationService, application_id: int) -> None:
    with pytest.raises(ApplicationNotFound):
        service.get(application_id)
    with pytest.raises(ApplicationNotFound):
        service.update(application_id, company="Spotify", role="Engineer")
    with pytest.raises(ApplicationNotFound):
        service.change_stage(application_id, "screen")
    with pytest.raises(ApplicationNotFound):
        service.delete(application_id)


@pytest.mark.parametrize(
    ("field", "limit"),
    [
        ("company", COMPANY_MAX_LENGTH),
        ("role", ROLE_MAX_LENGTH),
        ("location", LOCATION_MAX_LENGTH),
        ("salary_range", SALARY_RANGE_MAX_LENGTH),
        ("url", URL_MAX_LENGTH),
    ],
)
def test_values_longer_than_the_columns_are_not_stored(
    service: ApplicationService, field: str, limit: int
) -> None:
    values = {
        "company": "Spotify",
        "role": "Data Engineer",
        "location": "Berlin",
        "salary_range": "70-90k",
        "url": "https://jobs.example",
    }
    values[field] = "A" * (limit + 1)

    with pytest.raises(ApplicationError, match=f"{field} must be at most {limit}"):
        service.create(
            values["company"],
            values["role"],
            location=values["location"],
            salary_range=values["salary_range"],
            url=values["url"],
        )

    assert service.list_applications() == []


def test_repository_does_not_change_a_missing_row(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'applications.db'}")
    run_migrations(engine)
    session: Session = sessionmaker(engine)()
    repository = SqlApplicationRepository(session, clock=Clock())

    assert (
        repository.update_details(
            5,
            company="Spotify",
            role="Data Engineer",
            url=None,
            location=None,
            salary_range=None,
            applied_at=None,
        )
        is None
    )
    assert repository.update_stage(5, Stage.SCREEN) is None
    assert repository.delete(5) is False

    session.close()
    engine.dispose()

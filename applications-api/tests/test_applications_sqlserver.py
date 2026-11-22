"""Applications CRUD against a real SQL Server database.

The rest of the suite uses SQLite. This module runs only when
APPLICATIONS_TEST_SQLSERVER_URL points at a disposable database, such as the
SQL Server container from docker-compose. It does not run in CI and it must
not be pointed at Azure SQL.

Startup applies migration 0001 through the normal application lifespan.
"""

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.main import create_app


def _require_sql_server() -> Settings:
    url = os.getenv("APPLICATIONS_TEST_SQLSERVER_URL")
    if not url:
        pytest.skip("APPLICATIONS_TEST_SQLSERVER_URL must point to a disposable database")
    return Settings(
        _env_file=None,
        applications_db_url=url,
        db_connect_max_wait_seconds=30,
    )


def _instant(value: str) -> datetime:
    """Parse an API timestamp and require it to carry a timezone."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise AssertionError(f"timestamp has no timezone: {value}")
    return parsed.astimezone(UTC)


def _delete_all(settings: Settings, application_ids: list[int]) -> None:
    if not application_ids:
        return
    with TestClient(create_app(settings)) as client:
        for application_id in application_ids:
            client.delete(f"/applications/{application_id}")


def test_spotify_internship_round_trip_on_sql_server() -> None:
    settings = _require_sql_server()
    suffix = uuid4().hex[:8]
    company = f"Spotify {suffix}"
    other_company = f"Acme {suffix}"
    saved_ids: list[int] = []
    applied_at = datetime(2026, 11, 1, 9, 0, tzinfo=UTC)

    try:
        app = create_app(settings)
        with TestClient(app) as client:
            created = client.post(
                "/applications",
                json={
                    "company": f"  {company}  ",
                    "role": " Intern ",
                    "location": "Malmö",
                    "url": " https://jobs.example/spotify ",
                    "salary_range": "intern",
                    "applied_at": "2026-11-01T10:00:00+01:00",
                },
            )
            assert created.status_code == 201
            spotify = created.json()
            saved_ids.append(spotify["id"])
            assert spotify["id"] > 0
            assert spotify["company"] == company
            assert spotify["role"] == "Intern"
            assert spotify["stage"] == "applied"
            assert spotify["location"] == "Malmö"
            assert spotify["url"] == "https://jobs.example/spotify"
            assert _instant(spotify["applied_at"]) == applied_at
            assert _instant(spotify["created_at"]) == _instant(spotify["updated_at"])

            with app.state.engine.connect() as connection:
                column_type = connection.execute(
                    text(
                        "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_NAME = 'applications' AND COLUMN_NAME = 'applied_at'"
                    )
                ).scalar_one()
                offset_minutes = connection.execute(
                    text("SELECT DATEPART(TZOFFSET, applied_at) FROM applications WHERE id = :id"),
                    {"id": spotify["id"]},
                ).scalar_one()
            assert column_type == "datetimeoffset"
            assert offset_minutes == 0

            one = client.get(f"/applications/{spotify['id']}")
            assert one.status_code == 200
            assert one.json()["role"] == "Intern"

            other = client.post(
                "/applications",
                json={"company": other_company, "role": "Designer", "stage": "interview"},
            )
            assert other.status_code == 201
            saved_ids.append(other.json()["id"])

            applied = client.get("/applications", params={"stage": "applied"}).json()
            interviews = client.get("/applications", params={"stage": "interview"}).json()
            assert spotify["id"] in [item["id"] for item in applied]
            assert other.json()["id"] not in [item["id"] for item in applied]
            assert other.json()["id"] in [item["id"] for item in interviews]

            renamed = client.put(
                f"/applications/{spotify['id']}",
                json={
                    "company": company,
                    "role": "Backend Intern",
                    "location": "Malmö",
                    "url": "https://jobs.example/spotify",
                    "salary_range": "intern",
                    "applied_at": "2026-11-01T10:00:00+01:00",
                },
            )
            assert renamed.status_code == 200
            assert renamed.json()["role"] == "Backend Intern"
            assert renamed.json()["stage"] == "applied"
            assert _instant(renamed.json()["updated_at"]) >= _instant(renamed.json()["created_at"])
            created_at = renamed.json()["created_at"]

            moved = client.patch(
                f"/applications/{spotify['id']}/stage",
                json={"stage": "screen"},
            )
            assert moved.status_code == 200
            assert moved.json()["stage"] == "screen"
            assert moved.json()["role"] == "Backend Intern"

        reopened = create_app(settings)
        with TestClient(reopened) as client:
            persisted = client.get(f"/applications/{spotify['id']}")
            assert persisted.status_code == 200
            body = persisted.json()
            assert body["company"] == company
            assert body["role"] == "Backend Intern"
            assert body["stage"] == "screen"
            assert body["location"] == "Malmö"
            assert body["created_at"] == created_at
            assert _instant(body["applied_at"]) == applied_at

            deleted = client.delete(f"/applications/{spotify['id']}")
            assert deleted.status_code == 204
            assert client.get(f"/applications/{spotify['id']}").status_code == 404
            saved_ids.remove(spotify["id"])
    finally:
        _delete_all(settings, saved_ids)

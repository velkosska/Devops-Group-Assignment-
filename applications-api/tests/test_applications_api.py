"""HTTP tests for the applications board.

TestClient calls the real routes, service and SQLite database. It does not
prove Azure SQL.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        _env_file=None,
        applications_db_url=f"sqlite:///{tmp_path / 'applications.db'}",
    )
    with TestClient(create_app(settings)) as api:
        yield api


def test_health_still_answers_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_spotify_can_be_created_listed_edited_moved_and_deleted(client: TestClient) -> None:
    created = client.post(
        "/applications",
        json={
            "company": "  Spotify  ",
            "role": " Data Engineer ",
            "url": " https://jobs.example ",
            "applied_at": "2026-11-01T09:00:00",
        },
    )

    assert created.status_code == 201
    spotify = created.json()
    assert spotify["id"] == 1
    assert spotify["company"] == "Spotify"
    assert spotify["role"] == "Data Engineer"
    assert spotify["stage"] == "applied"
    assert spotify["url"] == "https://jobs.example"
    assert spotify["applied_at"].startswith("2026-11-01T09:00:00")
    assert "T" in spotify["created_at"]
    assert spotify["updated_at"] == spotify["created_at"]

    other = client.post(
        "/applications",
        json={"company": "Acme", "role": "Designer", "stage": "interview"},
    )
    assert other.status_code == 201

    listed = client.get("/applications")
    assert listed.status_code == 200
    assert [item["company"] for item in listed.json()] == ["Spotify", "Acme"]

    applied = client.get("/applications", params={"stage": "applied"})
    assert [item["company"] for item in applied.json()] == ["Spotify"]
    assert client.get("/applications", params={"stage": "screen"}).json() == []

    one = client.get("/applications/1")
    assert one.status_code == 200
    assert one.json()["role"] == "Data Engineer"

    renamed = client.put(
        "/applications/1",
        json={
            "company": "Spotify",
            "role": "Backend Engineer",
            "url": "https://jobs.example",
            "stage": "offer",
        },
    )
    assert renamed.status_code == 200
    assert renamed.json()["role"] == "Backend Engineer"
    assert renamed.json()["stage"] == "applied"
    assert renamed.json()["url"] == "https://jobs.example"
    assert renamed.json()["updated_at"] >= renamed.json()["created_at"]

    moved = client.patch("/applications/1/stage", json={"stage": "screen"})
    assert moved.status_code == 200
    assert moved.json()["stage"] == "screen"
    assert moved.json()["role"] == "Backend Engineer"

    same_stage = client.patch("/applications/1/stage", json={"stage": "screen"})
    assert same_stage.status_code == 422
    assert same_stage.json() == {"detail": "stage must change to a different stage"}
    assert client.get("/applications/1").json()["stage"] == "screen"

    deleted = client.delete("/applications/1")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get("/applications/1").status_code == 404
    assert [item["company"] for item in client.get("/applications").json()] == ["Acme"]


def test_unknown_application_is_not_found(client: TestClient) -> None:
    missing = "/applications/999"
    body = {"company": "Spotify", "role": "Data Engineer"}

    assert client.get(missing).status_code == 404
    assert client.put(missing, json=body).status_code == 404
    assert client.patch(f"{missing}/stage", json={"stage": "screen"}).status_code == 404
    assert client.delete(missing).status_code == 404
    assert client.get(missing).json() == {"detail": "application 999 was not found"}
    assert client.get("/applications").json() == []


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/applications", {"company": "   ", "role": "Data Engineer"}),
        ("post", "/applications", {"role": "Data Engineer"}),
        (
            "post",
            "/applications",
            {"company": "Spotify", "role": "Data Engineer", "stage": "hired"},
        ),
        (
            "post",
            "/applications",
            {"company": "Spotify", "role": "Data Engineer", "applied_at": "next week"},
        ),
        ("put", "/applications/1", {"company": "Spotify", "role": " "}),
        ("patch", "/applications/1/stage", {"stage": "hired"}),
    ],
)
def test_invalid_input_is_rejected(
    client: TestClient, method: str, path: str, payload: dict[str, str]
) -> None:
    response = client.request(method, path, json=payload)

    assert response.status_code == 422
    assert "detail" in response.json()
    assert "Traceback" not in response.text
    assert client.get("/applications").json() == []


def test_unknown_stage_filter_is_rejected(client: TestClient) -> None:
    response = client.get("/applications", params={"stage": "hired"})

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "stage must be one of: applied, screen, interview, offer, rejected"
    )


def test_routes_are_503_when_no_database_is_configured() -> None:
    app = create_app(Settings(_env_file=None, run_migrations_on_startup=False))

    response = TestClient(app).get("/applications")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not configured"}


def test_database_failure_mid_request_is_a_clear_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from sqlalchemy.exc import OperationalError

    from app.repositories.applications import SqlApplicationRepository

    def paused(*_args: object, **_kwargs: object) -> None:
        raise OperationalError("SELECT", {}, Exception("secret connection detail"))

    monkeypatch.setattr(SqlApplicationRepository, "list_applications", paused)
    response = client.get("/applications")

    assert response.status_code == 503
    assert response.json() == {"detail": "The database is temporarily unavailable"}
    assert "secret" not in response.text
    assert client.get("/health").status_code == 200

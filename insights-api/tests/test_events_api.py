from datetime import UTC, datetime
from unittest.mock import Mock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import get_session
from app.main import create_app

TEST_KEY = "test-key"


def valid_event() -> dict[str, object]:
    return {
        "event_id": str(uuid4()),
        "application_id": 1,
        "from_stage": "applied",
        "to_stage": "screen",
        "occurred_at": "2026-11-19T10:00:00Z",
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("INSIGHTS_API_KEY", TEST_KEY)
    app = create_app()
    app.dependency_overrides[get_session] = lambda: Mock(spec=Session)
    return TestClient(app)


def test_valid_event_with_key_is_accepted(client: TestClient, monkeypatch) -> None:
    write = Mock()
    monkeypatch.setattr("app.routes.events.store_event", write)
    event = valid_event()
    response = client.post("/events", json=event, headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 202
    assert response.json() == {"status": "accepted", "event_id": event["event_id"]}
    assert write.call_args.args[1:] == (
        UUID(str(event["event_id"])),
        1,
        "applied",
        "screen",
        datetime(2026, 11, 19, 10, tzinfo=UTC),
    )


def test_missing_key_is_rejected(client: TestClient) -> None:
    response = client.post("/events", json=valid_event())
    assert response.status_code == 401


def test_wrong_key_is_rejected(client: TestClient) -> None:
    response = client.post("/events", json=valid_event(), headers={"X-API-Key": "wrong"})
    assert response.status_code == 401


def test_non_ascii_invalid_key_is_rejected(client: TestClient) -> None:
    response = client.post("/events", json=valid_event(), headers=[(b"x-api-key", b"\xe9")])
    assert response.status_code == 401


def test_unconfigured_key_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INSIGHTS_API_KEY", raising=False)
    client = TestClient(create_app())
    response = client.post("/events", json=valid_event(), headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 503


def test_unknown_stage_is_rejected(client: TestClient) -> None:
    event = valid_event() | {"to_stage": "hired"}
    response = client.post("/events", json=event, headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 422


def test_event_without_change_is_rejected(client: TestClient) -> None:
    event = valid_event() | {"from_stage": "screen", "to_stage": "screen"}
    response = client.post("/events", json=event, headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 422


@pytest.mark.parametrize("timestamp", ["2026-11-19T10:00:00", "2026-11-19T11:00:00+01:00"])
def test_event_timestamp_is_normalized(client, monkeypatch, timestamp):
    write = Mock()
    monkeypatch.setattr("app.routes.events.store_event", write)
    event = valid_event() | {"occurred_at": timestamp}
    assert client.post("/events", json=event, headers={"X-API-Key": TEST_KEY}).status_code == 202
    assert write.call_args.args[-1] == datetime(2026, 11, 19, 10, tzinfo=UTC)
    assert write.call_args.args[-1].tzinfo is UTC


@pytest.mark.parametrize("change", [{"application_id": 0}, {"occurred_at": "yesterday"}])
def test_invalid_event_rejected(client, change):
    response = client.post("/events", json=valid_event() | change, headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 422


def test_missing_application_id_rejected(client):
    event = valid_event()
    del event["application_id"]
    assert client.post("/events", json=event, headers={"X-API-Key": TEST_KEY}).status_code == 422


def test_unconfigured_database_returns_503(monkeypatch):
    monkeypatch.setenv("INSIGHTS_API_KEY", TEST_KEY)
    client = TestClient(create_app())
    response = client.post("/events", json=valid_event(), headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 503
    assert response.json() == {"detail": "Event storage is not configured"}


def test_database_failure_is_clear_and_health_remains_available(client, monkeypatch):
    write = Mock(side_effect=[OperationalError(None, None, Exception("private")), None])
    monkeypatch.setattr("app.routes.events.store_event", write)
    event = valid_event()
    headers = {"X-API-Key": TEST_KEY}
    response = client.post("/events", json=event, headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": "Event storage is unavailable"}
    assert client.get("/health").status_code == 200
    assert client.post("/events", json=event, headers=headers).status_code == 202

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

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
    return TestClient(create_app())


def test_valid_event_with_key_is_accepted(client: TestClient) -> None:
    event = valid_event()
    response = client.post("/events", json=event, headers={"X-API-Key": TEST_KEY})
    assert response.status_code == 202
    assert response.json() == {"status": "accepted", "event_id": event["event_id"]}


def test_missing_key_is_rejected(client: TestClient) -> None:
    response = client.post("/events", json=valid_event())
    assert response.status_code == 401


def test_wrong_key_is_rejected(client: TestClient) -> None:
    response = client.post("/events", json=valid_event(), headers={"X-API-Key": "wrong"})
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

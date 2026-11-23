from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import get_session
from app.main import create_app


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_session] = lambda: Mock(spec=Session)
    return TestClient(app)


def test_dashboard_contract(client, monkeypatch):
    now = datetime.now(UTC).replace(tzinfo=None)
    records = [
        SimpleNamespace(
            application_id=1,
            from_stage=None,
            to_stage="applied",
            occurred_at=now - timedelta(days=20),
        ),
        SimpleNamespace(
            application_id=1,
            from_stage="applied",
            to_stage="interview",
            occurred_at=now - timedelta(days=10),
        ),
    ]
    monkeypatch.setattr("app.routes.history.read_events", Mock(return_value=records))
    assert client.get("/funnel").json() == {
        "total_applications": 1,
        "stages": [
            {"stage": "applied", "count": 1, "percentage": 100.0},
            {"stage": "screen", "count": 0, "percentage": 0.0},
            {"stage": "interview", "count": 1, "percentage": 100.0},
            {"stage": "offer", "count": 0, "percentage": 0.0},
            {"stage": "rejected", "count": 0, "percentage": 0.0},
        ],
    }
    assert client.get("/time-in-stage").json()[0] == {"stage": "applied", "median_days": 10.0}
    assert client.get("/stale").json() == {"threshold_days": 14, "applications": []}
    result = client.get("/stale?days=7").json()
    assert result["threshold_days"] == 7
    assert result["applications"] == [
        {
            "application_id": 1,
            "stage": "interview",
            "last_activity_at": records[-1].occurred_at.isoformat() + "Z",
        }
    ]
    for days in (0, -1, 36501, "invalid"):
        assert client.get(f"/stale?days={days}").status_code == 422


def test_empty_results_and_storage_failure(client, monkeypatch):
    read = Mock(side_effect=[[], OperationalError(None, None, Exception("private"))])
    monkeypatch.setattr("app.routes.history.read_events", read)
    response = client.get("/funnel")
    assert response.status_code == 200
    assert response.json()["total_applications"] == 0
    assert all(stage["percentage"] == 0 for stage in response.json()["stages"])
    response = client.get("/funnel")
    assert response.status_code == 503
    assert response.json() == {"detail": "Event storage is unavailable"}
    assert client.get("/health").status_code == 200


def test_snapshot_limit_returns_clear_error(client, monkeypatch):
    monkeypatch.setattr("app.routes.history.MAX_HISTORY_EVENTS", 0)
    monkeypatch.setattr("app.routes.history.read_events", Mock(return_value=[object()]))
    response = client.get("/funnel")
    assert response.status_code == 503
    assert response.json() == {"detail": "Event history exceeds the analytics limit"}


def test_analytics_without_database_returns_503():
    response = TestClient(create_app()).get("/funnel")
    assert response.status_code == 503
    assert response.json() == {"detail": "Event storage is not configured"}

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_funnel_endpoint():
    response = client.post(
        "/analytics/funnel",
        json={"stages": ["applied", "applied", "interview", "offer"]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "applied": 2,
        "screen": 0,
        "interview": 1,
        "offer": 1,
        "rejected": 0,
    }


def test_funnel_rejects_invalid_stage():
    response = client.post(
        "/analytics/funnel",
        json={"stages": ["unknown"]},
    )

    assert response.status_code == 422


def test_time_in_stage_endpoint():
    response = client.post(
        "/analytics/time-in-stage",
        json={
            "entered_at": "2026-11-10T12:00:00Z",
            "exited_at": "2026-11-15T12:00:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"days": 5.0}


def test_time_in_stage_rejects_invalid_dates():
    response = client.post(
        "/analytics/time-in-stage",
        json={
            "entered_at": "2026-11-15T12:00:00Z",
            "exited_at": "2026-11-10T12:00:00Z",
        },
    )

    assert response.status_code == 422


def test_stale_application_endpoint():
    last_updated = datetime.now(UTC) - timedelta(days=20)

    response = client.post(
        "/analytics/stale",
        json={"last_updated": last_updated.isoformat()},
    )

    assert response.status_code == 200
    assert response.json() == {"stale": True}


def test_recent_application_is_not_stale():
    last_updated = datetime.now(UTC) - timedelta(days=2)

    response = client.post(
        "/analytics/stale",
        json={"last_updated": last_updated.isoformat()},
    )

    assert response.status_code == 200
    assert response.json() == {"stale": False}


def test_stale_rejects_negative_threshold():
    response = client.post(
        "/analytics/stale",
        json={
            "last_updated": datetime.now(UTC).isoformat(),
            "threshold_days": -1,
        },
    )

    assert response.status_code == 422

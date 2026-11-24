from datetime import datetime, timedelta
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


def event(from_stage, to_stage, occurred_at):
    return SimpleNamespace(from_stage=from_stage, to_stage=to_stage, occurred_at=occurred_at)


def test_timeline_returns_history_oldest_first(client, monkeypatch):
    start = datetime(2026, 11, 1, 9, 0)
    records = [event(None, "applied", start), event("applied", "screen", start + timedelta(days=3))]
    read = Mock(return_value=records)
    monkeypatch.setattr("app.routes.history.read_application_events", read)
    response = client.get("/timeline/7")
    assert response.status_code == 200
    assert response.json() == {
        "application_id": 7,
        "events": [
            {"from_stage": None, "to_stage": "applied", "occurred_at": "2026-11-01T09:00:00Z"},
            {"from_stage": "applied", "to_stage": "screen", "occurred_at": "2026-11-04T09:00:00Z"},
        ],
    }
    assert read.call_args.args[1] == 7


def test_timeline_unknown_or_deleted_is_404(client, monkeypatch):
    start = datetime(2026, 11, 1)
    deleted = [event(None, "applied", start), event("applied", None, start + timedelta(days=1))]
    monkeypatch.setattr(
        "app.routes.history.read_application_events", Mock(side_effect=[[], deleted])
    )
    assert client.get("/timeline/1").status_code == 404
    assert client.get("/timeline/1").status_code == 404


def test_timeline_validation_and_storage_failure(client, monkeypatch):
    error = OperationalError(None, None, Exception("private"))
    monkeypatch.setattr("app.routes.history.read_application_events", Mock(side_effect=error))
    response = client.get("/timeline/1")
    assert response.status_code == 503
    assert response.json() == {"detail": "Event storage is unavailable"}
    assert client.get("/timeline/0").status_code == 422
    assert client.get("/timeline/abc").status_code == 422


def test_timeline_without_storage_is_503():
    app = create_app()
    app.dependency_overrides[get_session] = lambda: None
    assert TestClient(app).get("/timeline/1").status_code == 503


def test_legacy_stateless_analytics_routes_are_gone(client):
    assert client.post("/analytics/funnel", json={"stages": ["applied"]}).status_code == 404


def test_read_application_events_filters_and_orders():
    from uuid import uuid4

    from sqlalchemy import create_engine

    from app.repositories.events import Base, StageEventRecord, read_application_events

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    start = datetime(2026, 11, 1)
    # SQLite does not autoincrement BIGINT keys, so the test sets sequence itself.
    with Session(engine) as session:
        session.add_all(
            [
                StageEventRecord(
                    sequence=1,
                    event_id=uuid4(),
                    application_id=1,
                    from_stage="applied",
                    to_stage="screen",
                    occurred_at=start + timedelta(days=2),
                ),
                StageEventRecord(
                    sequence=2,
                    event_id=uuid4(),
                    application_id=2,
                    from_stage=None,
                    to_stage="applied",
                    occurred_at=start,
                ),
                StageEventRecord(
                    sequence=3,
                    event_id=uuid4(),
                    application_id=1,
                    from_stage=None,
                    to_stage="applied",
                    occurred_at=start,
                ),
            ]
        )
        session.commit()
        records = read_application_events(session, 1)
        assert [(r.from_stage, r.to_stage) for r in records] == [
            (None, "applied"),
            ("applied", "screen"),
        ]

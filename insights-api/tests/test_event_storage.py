import os
from io import StringIO
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import BASE_DIR
from app.main import create_app
from app.repositories.events import StageEventRecord, read_events


def test_migration_compiles_for_sql_server():
    output = StringIO()
    config = Config(str(BASE_DIR / "alembic.ini"), output_buffer=output)
    config.attributes["url"] = "mssql+pyodbc://"
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    for fragment in ("IDENTITY", "DATETIME2(6)", "UNIQUEIDENTIFIER", "ix_stage_events_history"):
        assert fragment in sql


def test_sql_server_startup_persistence_replay_and_event_order(monkeypatch):
    url = os.getenv("INSIGHTS_TEST_SQLSERVER_URL")
    if not url:
        pytest.skip("INSIGHTS_TEST_SQLSERVER_URL must point to an isolated test database")
    settings = Settings(insights_db_url=SecretStr(url), db_connect_max_wait_seconds=5)
    application_id = uuid4().int % (2**63 - 1) + 1
    late = {
        "event_id": str(uuid4()),
        "application_id": application_id,
        "from_stage": "applied",
        "to_stage": "screen",
        "occurred_at": "2026-11-19T11:00:00+01:00",
    }
    early = late | {
        "event_id": str(uuid4()),
        "from_stage": None,
        "to_stage": "applied",
        "occurred_at": "2026-11-18T10:00:00",
    }
    monkeypatch.setenv("INSIGHTS_API_KEY", "integration-test")
    headers = {"X-API-Key": "integration-test"}
    with TestClient(create_app(settings)) as client:
        assert client.post("/events", json=late, headers=headers).status_code == 202
        assert client.post("/events", json=early, headers=headers).status_code == 202
        replay = late | {"occurred_at": "2026-11-19T10:00:00Z"}
        assert client.post("/events", json=replay, headers=headers).status_code == 202
        conflict = late | {"to_stage": "interview"}
        assert client.post("/events", json=conflict, headers=headers).status_code == 409
        # The failed transaction cannot prevent the next event from being written.
        last = late | {
            "event_id": str(uuid4()),
            "from_stage": "screen",
            "to_stage": "interview",
            "occurred_at": "2026-11-20T10:00:00Z",
        }
        assert client.post("/events", json=last, headers=headers).status_code == 202

    app = create_app(settings)
    with TestClient(app) as client, Session(app.state.engine) as session:
        assert client.get("/health").status_code == 200
        funnel = client.get("/funnel")
        assert funnel.status_code == 200
        counts = {stage["stage"]: stage["count"] for stage in funnel.json()["stages"]}
        assert counts["applied"] >= 1
        assert counts["screen"] >= 1
        assert counts["interview"] >= 1
        durations = client.get("/time-in-stage")
        assert durations.status_code == 200
        assert (
            next(row for row in durations.json() if row["stage"] == "applied")["median_days"] == 1
        )
        assert client.get("/stale?days=7").status_code == 200
        history = [
            event for event in read_events(session) if event.application_id == application_id
        ]
        assert [str(event.event_id) for event in history] == [
            early["event_id"],
            late["event_id"],
            last["event_id"],
        ]
        assert (
            session.scalar(
                select(StageEventRecord.to_stage).where(
                    StageEventRecord.event_id == history[1].event_id
                )
            )
            == "screen"
        )

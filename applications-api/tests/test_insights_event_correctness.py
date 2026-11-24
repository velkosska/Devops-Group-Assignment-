"""Regression: which board actions publish Insights events.

The happy-path create / move / delete sequence is covered in
test_insights_events.py. These cases check the boundaries that must not
emit an extra event.
"""

import json
from collections.abc import Iterator
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.main import create_app
from app.repositories.applications import Base


@pytest.fixture
def board() -> Iterator[tuple[TestClient, list[dict[str, object]]]]:
    settings = Settings(insights_api_key=SecretStr("test-key"))
    app = create_app(settings)
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    app.state.session_factory = sessionmaker(engine)
    client = TestClient(app)
    received: list[dict[str, object]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        received.append(json.loads(request.content))
        return httpx.Response(202)

    with httpx.Client(transport=httpx.MockTransport(handle)) as http_client:
        with patch("app.services.insights.httpx.stream", http_client.stream):
            yield client, received

    engine.dispose()


def test_detail_updates_and_rejected_moves_do_not_publish_events(
    board: tuple[TestClient, list[dict[str, object]]],
) -> None:
    client, received = board

    created = client.post(
        "/applications",
        json={"company": "Spotify", "role": "Data Engineer"},
    )
    assert created.status_code == 201
    app_id = created.json()["id"]
    path = f"/applications/{app_id}"
    assert [(event["from_stage"], event["to_stage"]) for event in received] == [(None, "applied")]

    renamed = client.put(
        path,
        json={"company": "Spotify", "role": "Backend Engineer", "url": "https://jobs.example"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["role"] == "Backend Engineer"
    assert renamed.json()["stage"] == "applied"
    assert len(received) == 1

    same_stage = client.patch(f"{path}/stage", json={"stage": "applied"})
    assert same_stage.status_code == 422
    assert client.get(path).json()["stage"] == "applied"
    assert len(received) == 1

    invalid_stage = client.patch(f"{path}/stage", json={"stage": "hired"})
    assert invalid_stage.status_code == 422
    assert client.get(path).json()["stage"] == "applied"
    assert len(received) == 1

    moved = client.patch(f"{path}/stage", json={"stage": "screen"})
    assert moved.status_code == 200
    assert moved.json()["stage"] == "screen"
    assert [(event["from_stage"], event["to_stage"]) for event in received] == [
        (None, "applied"),
        ("applied", "screen"),
    ]

    deleted = client.delete(path)
    assert deleted.status_code == 204
    assert [(event["from_stage"], event["to_stage"]) for event in received] == [
        (None, "applied"),
        ("applied", "screen"),
        ("screen", None),
    ]

    missing = client.delete(path)
    assert missing.status_code == 404
    assert len(received) == 3

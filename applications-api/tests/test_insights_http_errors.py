"""Regression: Insights HTTP failures must not undo a successful board write.

Timeouts are covered in test_insights_events.py. These cases cover non-202
responses that still leave the application row saved.
"""

import logging
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

API_KEY = "test-key-must-stay-secret"
PRIVATE_BODY = "upstream denied: do-not-log-this"


@pytest.fixture
def board() -> Iterator[TestClient]:
    settings = Settings(insights_api_key=SecretStr(API_KEY))
    app = create_app(settings)
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    app.state.session_factory = sessionmaker(engine)
    yield TestClient(app)
    engine.dispose()


@pytest.mark.parametrize("status_code", [503, 401])
def test_insights_http_errors_keep_the_board_saved(
    board: TestClient, status_code: int, caplog: pytest.LogCaptureFixture
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == API_KEY
        return httpx.Response(status_code, text=PRIVATE_BODY)

    with (
        httpx.Client(transport=httpx.MockTransport(handle)) as http_client,
        patch("app.services.insights.httpx.stream", http_client.stream),
        caplog.at_level(logging.WARNING, logger="app.services.insights"),
    ):
        created = board.post(
            "/applications",
            json={"company": "Spotify", "role": "Data Engineer"},
        )
        assert created.status_code == 201
        app_id = created.json()["id"]
        path = f"/applications/{app_id}"

        assert board.get(path).json()["company"] == "Spotify"

        moved = board.patch(f"{path}/stage", json={"stage": "screen"})
        assert moved.status_code == 200
        assert board.get(path).json()["stage"] == "screen"

    warnings = [record.getMessage() for record in caplog.records]
    assert any(f"HTTP {status_code}" in message for message in warnings)
    joined = "\n".join(warnings)
    assert API_KEY not in joined
    assert PRIVATE_BODY not in joined
    assert "do-not-log-this" not in joined
    # The request JSON must also stay out of the warning line.
    assert "Spotify" not in joined
    assert "event_id" not in joined

import json
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.main import create_app
from app.repositories.applications import Base


def test_board_delivery_and_partial_failure(caplog):
    settings = Settings(insights_api_key=SecretStr("test-key"))
    app = create_app(settings)
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    app.state.session_factory = sessionmaker(engine)
    client = TestClient(app)
    received = []

    def handle(request):
        event = json.loads(request.content)
        received.append(event)
        assert request.url == "http://insights-api:8001/events"
        assert request.headers["X-API-Key"] == "test-key"
        assert request.extensions["timeout"]["read"] == 2
        if event["to_stage"] == "interview":
            raise httpx.ReadTimeout("private", request=request)
        return httpx.Response(202)

    with httpx.Client(transport=httpx.MockTransport(handle)) as http_client:
        with patch("app.services.insights.httpx.stream", http_client.stream):
            created = client.post("/applications", json={"company": "Example", "role": "Dev"})
            assert created.status_code == 201
            app_id = created.json()["id"]
            path = f"/applications/{app_id}"
            assert client.patch(f"{path}/stage", json={"stage": "interview"}).status_code == 200
            assert client.get(path).json()["stage"] == "interview"
            assert client.get("/health").status_code == 200
            assert client.patch(f"{path}/stage", json={"stage": "offer"}).status_code == 200
            assert client.delete(path).status_code == 204
    assert [(event["from_stage"], event["to_stage"]) for event in received] == [
        (None, "applied"),
        ("applied", "interview"),
        ("interview", "offer"),
        ("offer", None),
    ]
    assert all(event["application_id"] == app_id for event in received)
    assert all(event["occurred_at"].endswith("+00:00") for event in received)
    assert len({event["event_id"] for event in received}) == 4
    assert "ReadTimeout" in caplog.text
    assert "private" not in caplog.text

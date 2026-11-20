import logging

from fastapi.testclient import TestClient

from app.main import app


def test_health_request_is_logged(caplog):
    client = TestClient(app)

    with caplog.at_level(logging.INFO, logger="insights.monitoring"):
        response = client.get("/health")

    assert response.status_code == 200

    messages = [
        record.getMessage() for record in caplog.records if record.name == "insights.monitoring"
    ]

    assert any(
        "method=GET" in message
        and "path=/health" in message
        and "status=200" in message
        and "duration_ms=" in message
        for message in messages
    )

import json
import logging
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.logging_config import ACCESS_LOGGER_NAME
from app.main import create_app


class ListHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(record.getMessage())


@pytest.fixture
def access_lines() -> Iterator[list[str]]:
    handler = ListHandler()
    logger = logging.getLogger(ACCESS_LOGGER_NAME)
    logger.addHandler(handler)
    yield handler.lines
    logger.removeHandler(handler)


def build_app() -> FastAPI:
    app = create_app(Settings(_env_file=None))

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    return app


def test_one_json_line_per_request_with_method_path_status_duration(
    access_lines: list[str],
) -> None:
    TestClient(build_app()).get("/health")

    assert len(access_lines) == 1
    record = json.loads(access_lines[0])
    assert record["method"] == "GET"
    assert record["path"] == "/health"
    assert record["status"] == 200
    assert isinstance(record["duration_ms"], int | float)
    assert record["duration_ms"] >= 0


def test_query_string_is_not_logged(access_lines: list[str]) -> None:
    TestClient(build_app()).get("/health?token=abc123")

    assert "abc123" not in access_lines[0]
    assert json.loads(access_lines[0])["path"] == "/health"


def test_unknown_path_is_logged_with_404(access_lines: list[str]) -> None:
    TestClient(build_app()).get("/missing")

    assert json.loads(access_lines[0])["status"] == 404


def test_unhandled_error_is_logged_as_500(access_lines: list[str]) -> None:
    client = TestClient(build_app(), raise_server_exceptions=False)

    response = client.get("/boom")

    assert response.status_code == 500
    record = json.loads(access_lines[0])
    assert record["status"] == 500
    assert "secret internal detail" not in access_lines[0]


def test_configure_logging_is_idempotent() -> None:
    build_app()
    build_app()

    handlers = [
        h
        for h in logging.getLogger(ACCESS_LOGGER_NAME).handlers
        if getattr(h, "_app_stdout", False)
    ]
    assert len(handlers) == 1

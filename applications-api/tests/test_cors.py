from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

UI_ORIGIN = "https://ui.example.test"


def client() -> TestClient:
    return TestClient(create_app(Settings(_env_file=None, cors_allowed_origin=UI_ORIGIN)))


def preflight(origin: str):
    return client().options(
        "/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


def test_allowed_origin_gets_cors_header() -> None:
    response = preflight(UI_ORIGIN)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == UI_ORIGIN


def test_other_origin_is_not_allowed() -> None:
    response = preflight("https://evil.example.test")

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_simple_request_from_other_origin_has_no_cors_header() -> None:
    response = client().get("/health", headers={"Origin": "https://evil.example.test"})

    assert "access-control-allow-origin" not in response.headers

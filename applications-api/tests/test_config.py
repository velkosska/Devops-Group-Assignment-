import pytest

from app.config import Settings


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "CORS_ALLOWED_ORIGIN",
        "LOG_LEVEL",
        "APPLICATIONS_DB_URL",
        "RUN_MIGRATIONS_ON_STARTUP",
        "INSIGHTS_URL",
        "INSIGHTS_API_KEY",
        "INSIGHTS_TIMEOUT_SECONDS",
    ):
        monkeypatch.delenv(name, raising=False)


def test_defaults_are_safe_and_secrets_are_unset() -> None:
    settings = Settings(_env_file=None)

    assert settings.cors_allowed_origin == "http://localhost:5173"
    assert settings.log_level == "INFO"
    assert settings.run_migrations_on_startup is True
    assert settings.insights_timeout_seconds == 2.0
    assert settings.applications_db_url is None
    assert settings.insights_api_key is None


def test_values_are_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGIN", "https://ui.example.test")
    monkeypatch.setenv("RUN_MIGRATIONS_ON_STARTUP", "false")
    monkeypatch.setenv("INSIGHTS_TIMEOUT_SECONDS", "1.5")
    monkeypatch.setenv("INSIGHTS_API_KEY", "super-secret")

    settings = Settings(_env_file=None)

    assert settings.cors_allowed_origin == "https://ui.example.test"
    assert settings.run_migrations_on_startup is False
    assert settings.insights_timeout_seconds == 1.5
    assert settings.insights_api_key is not None
    assert settings.insights_api_key.get_secret_value() == "super-secret"


def test_secrets_are_masked_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APPLICATIONS_DB_URL", "mssql+pyodbc://user:hunter2@host/db")
    monkeypatch.setenv("INSIGHTS_API_KEY", "super-secret")

    rendered = repr(Settings(_env_file=None))

    assert "hunter2" not in rendered
    assert "super-secret" not in rendered

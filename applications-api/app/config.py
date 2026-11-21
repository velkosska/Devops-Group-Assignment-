from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read only from environment variables.

    Names match `.env.example`. Real values live in GitHub Actions secrets and
    Azure Container Apps secrets, never in the repository.

    Secrets are `SecretStr` so they are masked in logs and reprs, and have no
    default value. Features that need them (database, insights calls) must fail
    clearly when they are missing.
    """

    model_config = SettingsConfigDict(extra="ignore")

    # Origin of the static UI; CORS allows only this origin.
    cors_allowed_origin: str = "http://localhost:5173"
    log_level: str = "INFO"

    # Database (used from the database PR onwards).
    applications_db_url: SecretStr | None = None
    run_migrations_on_startup: bool = True
    # How long startup waits for a paused serverless database to resume.
    db_connect_max_wait_seconds: float = 90.0

    # Service-to-service call to insights-api (used when stage events are sent).
    insights_url: str = "http://insights-api:8001"
    insights_api_key: SecretStr | None = None
    insights_timeout_seconds: float = 2.0


@lru_cache
def get_settings() -> Settings:
    return Settings()

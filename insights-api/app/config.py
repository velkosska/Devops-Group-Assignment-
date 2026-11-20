from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read only from environment variables.

    Same pattern as applications-api. Names match `.env.example`. Real values
    live in GitHub Actions secrets and Azure Container Apps secrets, never in
    the repository. Secrets are `SecretStr` (masked) and have no default.
    """

    model_config = SettingsConfigDict(extra="ignore")

    # Origin of the static UI; CORS allows only this origin.
    cors_allowed_origin: str = "http://localhost:5173"
    log_level: str = "INFO"

    # Database (used once event storage is added).
    insights_db_url: SecretStr | None = None
    run_migrations_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()

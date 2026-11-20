from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.logging_config import configure_logging, request_logging_middleware
from app.routes import events, health


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="insights-api")
    app.include_router(health.router)
    app.include_router(events.router)

    # CORS is restricted to the static UI origin only.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_allowed_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    # Added last so it is the outermost middleware and also logs preflight requests.
    app.middleware("http")(request_logging_middleware)
    return app


app = create_app()

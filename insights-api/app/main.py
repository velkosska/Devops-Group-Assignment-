from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.config import Settings, get_settings
from app.db import initialise_database
from app.logging_config import configure_logging, request_logging_middleware
from app.routes import analytics, events, health, history


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Runs when the server starts: wait for the database, then migrate.
        engine = initialise_database(settings)
        app.state.engine = engine
        app.state.session_factory = sessionmaker(engine) if engine is not None else None
        try:
            yield
        finally:
            if engine is not None:
                engine.dispose()

    app = FastAPI(title="insights-api", lifespan=lifespan)
    app.state.engine = None
    app.state.session_factory = None
    app.include_router(health.router)
    app.include_router(events.router)
    app.include_router(history.router)
    app.include_router(analytics.router)

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

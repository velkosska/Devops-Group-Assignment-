from fastapi import FastAPI

from app.monitoring import setup_monitoring
from app.routes import analytics, events, health


def create_app() -> FastAPI:
    app = FastAPI(title="insights-api")
    setup_monitoring(app)
    app.include_router(health.router)
    app.include_router(events.router)
    app.include_router(analytics.router)
    return app


app = create_app()

from fastapi import FastAPI

from app.routes import events, health


def create_app() -> FastAPI:
    app = FastAPI(title="insights-api")
    app.include_router(health.router)
    app.include_router(events.router)
    return app


app = create_app()

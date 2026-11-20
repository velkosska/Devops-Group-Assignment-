import logging
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("insights.monitoring")


def setup_monitoring(app: FastAPI) -> None:
    """Log HTTP request status and duration."""

    logging.basicConfig(level=logging.INFO)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "method=%s path=%s status=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
            )

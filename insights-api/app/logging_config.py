import json
import logging
import sys
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

ACCESS_LOGGER_NAME = "app.access"


def configure_logging(level: str = "INFO") -> logging.Logger:
    """Send one plain-message line per record to stdout. Safe to call repeatedly."""
    logger = logging.getLogger(ACCESS_LOGGER_NAME)
    logger.setLevel(level.upper())
    logger.propagate = False
    if not any(getattr(h, "_app_stdout", False) for h in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        handler._app_stdout = True  # type: ignore[attr-defined]
        logger.addHandler(handler)
    return logger


def _log_request(method: str, path: str, status: int, started: float) -> None:
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    # Only method, path (no query string) and outcome: never bodies or headers.
    line = {"method": method, "path": path, "status": status, "duration_ms": duration_ms}
    logging.getLogger(ACCESS_LOGGER_NAME).info(json.dumps(line))


async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        _log_request(request.method, request.url.path, 500, started)
        raise
    _log_request(request.method, request.url.path, response.status_code, started)
    return response

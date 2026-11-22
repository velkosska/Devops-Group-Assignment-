# insights-api image.
# Base image is pinned by digest. Dependabot or a manual bump updates it.
FROM python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# NOTE: insights-api has no database yet. When it gets one (same pattern as
# applications-api, see docs/database-migrations.md), copy the ODBC driver
# install block and the `COPY migrations/` and `COPY alembic.ini` lines from
# applications-api/Dockerfile.

# Run as a non-root user.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin appuser

WORKDIR /app

# Dependencies first, so this layer is cached until requirements.txt changes.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy only what the service needs, never the whole directory.
COPY app/ ./app/

USER 10001

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=4)"]

# --no-access-log: the app writes its own JSON line per request.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]

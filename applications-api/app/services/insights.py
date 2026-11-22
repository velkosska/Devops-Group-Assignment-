import logging
from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.config import Settings
from app.domain.stages import Stage

logger = logging.getLogger(__name__)


class InsightsEvents:
    """Best-effort event delivery after the Applications transaction commits."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def publish(
        self,
        application_id: int,
        from_stage: Stage | None,
        to_stage: Stage | None,
        occurred_at: datetime,
    ) -> None:
        key = self._settings.insights_api_key
        if key is None:
            logger.warning("Insights event delivery skipped because the API key is unset")
            return
        payload = {
            "event_id": str(uuid4()),
            "application_id": application_id,
            "from_stage": from_stage,
            "to_stage": to_stage,
            "occurred_at": occurred_at.astimezone(UTC).isoformat(),
        }
        try:
            with httpx.stream(
                "POST",
                f"{self._settings.insights_url.rstrip('/')}/events",
                json=payload,
                headers={"X-API-Key": key.get_secret_value()},
                timeout=self._settings.insights_timeout_seconds,
                follow_redirects=False,
            ) as response:
                if response.status_code != 202:
                    logger.warning("Insights event delivery returned HTTP %s", response.status_code)
        except (httpx.HTTPError, httpx.InvalidURL, UnicodeError) as exc:
            logger.warning("Insights event delivery failed (%s)", type(exc).__name__)

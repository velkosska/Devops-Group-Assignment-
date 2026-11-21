import hmac
import os
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_session
from app.domain.events import describes_change
from app.domain.stages import Stage
from app.repositories.events import EventConflictError, store_event

router = APIRouter()


class StageEvent(BaseModel):
    event_id: UUID
    application_id: int = Field(gt=0, le=2**63 - 1)
    from_stage: Stage | None = None
    to_stage: Stage | None = None
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        try:
            return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        except OverflowError as exc:
            raise ValueError("occurred_at is outside the supported UTC range") from exc

    @model_validator(mode="after")
    def must_describe_a_change(self) -> "StageEvent":
        if not describes_change(self.from_stage, self.to_stage):
            raise ValueError("from_stage and to_stage must describe a change")
        return self


def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    expected = os.environ.get("INSIGHTS_API_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="Event intake is not configured")
    if x_api_key is None or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/events", status_code=202, dependencies=[Depends(require_api_key)])
def receive_event(
    event: StageEvent, session: Annotated[Session | None, Depends(get_session)]
) -> dict[str, str]:
    """Acknowledge a new event only after commit, or an identical replay."""
    if session is None:
        raise HTTPException(status_code=503, detail="Event storage is not configured")
    try:
        store_event(
            session,
            event.event_id,
            event.application_id,
            event.from_stage,
            event.to_stage,
            event.occurred_at,
        )
    except EventConflictError:
        raise HTTPException(status_code=409, detail="Event ID already has different data") from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Event storage is unavailable") from None
    return {"status": "accepted", "event_id": str(event.event_id)}

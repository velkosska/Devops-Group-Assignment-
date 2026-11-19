import hmac
import os
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.domain.events import describes_change
from app.domain.stages import Stage

router = APIRouter()


class StageEvent(BaseModel):
    event_id: UUID
    application_id: int = Field(gt=0)
    from_stage: Stage | None = None
    to_stage: Stage | None = None
    occurred_at: datetime

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
def receive_event(event: StageEvent) -> dict[str, str]:
    """Accepts a stage event. Not stored yet: storage comes with the database."""
    return {"status": "accepted", "event_id": str(event.event_id)}

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.domain.analytics import calculate_funnel
from app.domain.stages import Stage
from app.domain.stale_applications import is_stale
from app.domain.time_in_stage import calculate_time_in_stage

router = APIRouter(prefix="/analytics", tags=["analytics"])


# 1. Funnel Analytics
class FunnelRequest(BaseModel):
    stages: list[Stage]


@router.post("/funnel")
def get_funnel(request: FunnelRequest) -> dict[str, int]:
    """Calculate funnel counts from supplied application stages."""
    return calculate_funnel(request.stages)


# 2. Time-in-Stage Analytics
class TimeInStageRequest(BaseModel):
    entered_at: datetime
    exited_at: datetime


@router.post("/time-in-stage")
def get_time_in_stage(request: TimeInStageRequest) -> dict[str, float]:
    """Calculate days spent in an application stage."""
    try:
        days = calculate_time_in_stage(
            request.entered_at,
            request.exited_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"days": days}


# 3. Stale Applications Detection
class StaleApplicationRequest(BaseModel):
    last_updated: datetime
    threshold_days: int = Field(default=14, ge=0)

    @field_validator("last_updated")
    @classmethod
    def normalize_last_updated(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


@router.post("/stale")
def check_stale_application(
    request: StaleApplicationRequest,
) -> dict[str, bool]:
    """Check whether an application has been inactive too long."""
    try:
        stale = is_stale(
            last_updated=request.last_updated,
            now=datetime.now(UTC),
            threshold_days=request.threshold_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"stale": stale}

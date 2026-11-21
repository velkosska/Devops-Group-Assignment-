from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_session
from app.domain.history import HistorySummary, StaleApplication, Transition, summarize_history
from app.domain.stages import Stage
from app.repositories.events import read_events

router = APIRouter(tags=["analytics"])
MAX_HISTORY_EVENTS = 50_000
Database = Annotated[Session | None, Depends(get_session)]


class FunnelStage(BaseModel):
    stage: Stage
    count: int
    percentage: float


class HistoricalFunnel(BaseModel):
    total_applications: int
    stages: list[FunnelStage]


class StageDuration(BaseModel):
    stage: Stage
    median_days: float | None


class StaleApplications(BaseModel):
    threshold_days: int
    applications: list[StaleApplication]


def analytics_snapshot(session: Session | None, threshold_days: int = 14) -> HistorySummary:
    if session is None:
        raise HTTPException(status_code=503, detail="Event storage is not configured")
    try:
        events = []
        for record in read_events(session, limit=MAX_HISTORY_EVENTS + 1):
            if len(events) == MAX_HISTORY_EVENTS:
                raise HTTPException(
                    status_code=503, detail="Event history exceeds the analytics limit"
                )
            events.append(
                Transition(
                    record.application_id,
                    Stage(record.from_stage) if record.from_stage is not None else None,
                    Stage(record.to_stage) if record.to_stage is not None else None,
                    record.occurred_at.replace(tzinfo=UTC),
                )
            )
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Event storage is unavailable") from None
    return summarize_history(events, now=datetime.now(UTC), threshold_days=threshold_days)


@router.get("/funnel")
def historical_funnel(session: Database) -> HistoricalFunnel:
    summary = analytics_snapshot(session)
    total = summary.total_applications
    return HistoricalFunnel(
        total_applications=total,
        stages=[
            FunnelStage(
                stage=stage, count=count, percentage=round(100 * count / total, 2) if total else 0
            )
            for stage, count in summary.reached.items()
        ],
    )


@router.get("/time-in-stage")
def median_time_in_stage(session: Database) -> list[StageDuration]:
    return [
        StageDuration(stage=stage, median_days=days)
        for stage, days in analytics_snapshot(session).median_days.items()
    ]


@router.get("/stale")
def stale_applications(
    session: Database, days: Annotated[int, Query(gt=0, le=36500)] = 14
) -> StaleApplications:
    return StaleApplications(
        threshold_days=days, applications=analytics_snapshot(session, threshold_days=days).stale
    )

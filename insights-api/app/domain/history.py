from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import groupby
from operator import attrgetter
from statistics import median

from app.domain.stages import Stage

FINAL_STAGES = {Stage.OFFER, Stage.REJECTED}


@dataclass(frozen=True)
class Transition:
    application_id: int
    from_stage: Stage | None
    to_stage: Stage | None
    occurred_at: datetime


@dataclass(frozen=True)
class StaleApplication:
    application_id: int
    stage: Stage
    last_activity_at: datetime


@dataclass
class HistorySummary:
    total_applications: int
    reached: dict[Stage, int]
    median_days: dict[Stage, float | None]
    stale: list[StaleApplication]


def summarize_history(
    events: Iterable[Transition], *, now: datetime, threshold_days: int = 14
) -> HistorySummary:
    """Summarize observed, non-deleted applications. Event order breaks timestamp ties."""
    reached = dict.fromkeys(Stage, 0)
    days: dict[Stage, list[float]] = {stage: [] for stage in Stage}
    stale = []
    total = 0
    cutoff = now - timedelta(days=threshold_days)
    key = attrgetter("application_id")

    for application_id, history in groupby(sorted(events, key=key), key=key):
        ordered = sorted(history, key=lambda event: event.occurred_at)
        latest = ordered[-1]
        if latest.to_stage is None:
            continue
        total += 1
        visited = {stage for event in ordered for stage in (event.from_stage, event.to_stage)}
        for stage in visited - {None}:
            reached[stage] += 1
        for arrival, departure in zip(ordered, ordered[1:], strict=False):
            stage = arrival.to_stage
            if stage is not None and stage == departure.from_stage:
                duration = departure.occurred_at - arrival.occurred_at
                days[stage].append(duration / timedelta(days=1))
        if latest.to_stage not in FINAL_STAGES and latest.occurred_at < cutoff:
            stale.append(
                StaleApplication(
                    application_id, latest.to_stage, latest.occurred_at.astimezone(UTC)
                )
            )

    return HistorySummary(
        total,
        reached,
        {stage: median(values) if values else None for stage, values in days.items()},
        stale,
    )

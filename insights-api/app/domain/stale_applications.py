from datetime import datetime, timedelta


def is_stale(
    last_updated: datetime,
    now: datetime,
    threshold_days: int = 14,
) -> bool:
    """Check whether an application has been inactive too long."""
    if last_updated.tzinfo is None or now.tzinfo is None:
        raise ValueError("Timestamps must include timezone information")

    if threshold_days < 0:
        raise ValueError("Threshold cannot be negative")

    if last_updated > now:
        raise ValueError("Last update cannot be in the future")

    return now - last_updated > timedelta(days=threshold_days)

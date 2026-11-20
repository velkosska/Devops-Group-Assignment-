from datetime import datetime


def calculate_time_in_stage(entered_at: datetime, exited_at: datetime) -> float:
    """Calculate the number of days spent in a stage."""
    if entered_at.tzinfo is None or exited_at.tzinfo is None:
        raise ValueError("Timestamps must include timezone information")

    if exited_at < entered_at:
        raise ValueError("Exit cannot be before entry")

    duration = exited_at - entered_at
    return duration.total_seconds() / 86400

from app.domain.stages import Stage


def describes_change(from_stage: Stage | None, to_stage: Stage | None) -> bool:
    """An event must change something.

    from_stage is None when an application is created,
    to_stage is None when it is deleted. Both None, or the same
    stage twice, is not a change.
    """
    if from_stage is None and to_stage is None:
        return False
    return from_stage != to_stage

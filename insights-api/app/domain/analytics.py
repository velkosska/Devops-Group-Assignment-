from collections import Counter

from app.domain.stages import Stage


def calculate_funnel(stages: list[Stage]) -> dict[str, int]:
    """Count applications in each pipeline stage."""
    counts = Counter(stages)

    return {stage.value: counts[stage] for stage in Stage}

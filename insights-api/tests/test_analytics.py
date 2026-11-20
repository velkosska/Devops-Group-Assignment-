
from app.domain.analytics import calculate_funnel
from app.domain.stages import Stage


def test_funnel_counts_applications():
    stages = [
        Stage.APPLIED,
        Stage.APPLIED,
        Stage.INTERVIEW,
    ]

    result = calculate_funnel(stages)

    assert result["applied"] == 2
    assert result["interview"] == 1
    assert sum(result.values()) == 3

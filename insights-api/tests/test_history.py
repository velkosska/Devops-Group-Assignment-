from datetime import UTC, datetime, timedelta

import pytest

from app.domain.history import Transition, summarize_history
from app.domain.stages import Stage

NOW = datetime(2026, 11, 21, 12, tzinfo=UTC)


def event(app_id, age_days, before, after):
    return Transition(app_id, before, after, NOW - timedelta(days=age_days))


def test_historical_funnel_and_median_with_reentry():
    events = [
        event(1, 5, Stage.INTERVIEW, Stage.REJECTED),
        event(2, 6, None, Stage.APPLIED),
        event(1, 20, None, Stage.APPLIED),
        event(1, 18, Stage.APPLIED, Stage.INTERVIEW),
        event(1, 17, Stage.INTERVIEW, Stage.APPLIED),
        event(1, 11, Stage.APPLIED, Stage.INTERVIEW),
        event(2, 2, Stage.APPLIED, Stage.SCREEN),
    ]
    result = summarize_history(events, now=NOW)
    assert result.total_applications == 2
    assert result.reached == {
        Stage.APPLIED: 2,
        Stage.SCREEN: 1,
        Stage.INTERVIEW: 1,
        Stage.OFFER: 0,
        Stage.REJECTED: 1,
    }
    assert result.median_days[Stage.APPLIED] == 4
    assert result.median_days[Stage.INTERVIEW] == 3.5
    assert result.median_days[Stage.SCREEN] is None


def test_deleted_applications_and_missing_intervals():
    events = [
        event(1, 20, None, Stage.APPLIED),
        event(1, 1, Stage.APPLIED, None),
        event(2, 20, None, Stage.APPLIED),
        event(2, 10, Stage.INTERVIEW, Stage.SCREEN),
    ]
    result = summarize_history(events, now=NOW)
    assert result.total_applications == 1
    assert result.reached[Stage.INTERVIEW] == 1
    assert not any(result.median_days.values())


@pytest.mark.parametrize(("threshold_days", "expected"), [(14, [1]), (7, [1, 2])])
def test_stale_rules(threshold_days, expected):
    events = [
        event(1, 15, None, Stage.APPLIED),
        event(2, 14, Stage.APPLIED, Stage.SCREEN),
        event(3, 21, Stage.INTERVIEW, Stage.OFFER),
        event(4, 21, Stage.INTERVIEW, Stage.REJECTED),
        event(5, -1, None, Stage.INTERVIEW),
        event(6, 30, None, Stage.APPLIED),
        event(6, 1, Stage.APPLIED, Stage.SCREEN),
    ]
    result = summarize_history(events, now=NOW, threshold_days=threshold_days)
    assert [application.application_id for application in result.stale] == expected
    assert result.stale[0].last_activity_at == NOW - timedelta(days=15)


def test_empty_history():
    result = summarize_history([], now=NOW)
    assert result.total_applications == 0
    assert list(result.reached.values()) == [0] * 5
    assert list(result.median_days.values()) == [None] * 5
    assert result.stale == []

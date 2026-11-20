from datetime import UTC, datetime

import pytest

from app.domain.time_in_stage import calculate_time_in_stage


def test_five_days_in_stage():
    entered = datetime(2026, 11, 15, tzinfo=UTC)
    exited = datetime(2026, 11, 20, tzinfo=UTC)

    assert calculate_time_in_stage(entered, exited) == 5.0


def test_half_day_in_stage():
    entered = datetime(2026, 11, 15, 8, tzinfo=UTC)
    exited = datetime(2026, 11, 15, 20, tzinfo=UTC)

    assert calculate_time_in_stage(entered, exited) == 0.5


def test_exit_before_entry_is_rejected():
    entered = datetime(2026, 11, 20, tzinfo=UTC)
    exited = datetime(2026, 11, 15, tzinfo=UTC)

    with pytest.raises(ValueError):
        calculate_time_in_stage(entered, exited)


def test_missing_timezone_is_rejected():
    entered = datetime(2026, 11, 15)
    exited = datetime(2026, 11, 20, tzinfo=UTC)

    with pytest.raises(ValueError):
        calculate_time_in_stage(entered, exited)

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.stale_applications import is_stale

NOW = datetime(2026, 11, 20, tzinfo=UTC)


def test_application_is_stale():
    last_updated = NOW - timedelta(days=20)
    assert is_stale(last_updated, NOW) is True


def test_recent_application_is_not_stale():
    last_updated = NOW - timedelta(days=5)
    assert is_stale(last_updated, NOW) is False


def test_exactly_at_threshold_is_not_stale():
    last_updated = NOW - timedelta(days=14)
    assert is_stale(last_updated, NOW) is False


def test_custom_threshold():
    last_updated = NOW - timedelta(days=8)
    assert is_stale(last_updated, NOW, threshold_days=7) is True


def test_future_timestamp_is_rejected():
    last_updated = NOW + timedelta(days=1)

    with pytest.raises(ValueError):
        is_stale(last_updated, NOW)


def test_missing_timezone_is_rejected():
    last_updated = datetime(2026, 11, 1)

    with pytest.raises(ValueError):
        is_stale(last_updated, NOW)


def test_negative_threshold_is_rejected():
    with pytest.raises(ValueError):
        is_stale(NOW, NOW, threshold_days=-1)

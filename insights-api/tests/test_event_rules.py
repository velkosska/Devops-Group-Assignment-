from app.domain.events import describes_change
from app.domain.stages import Stage


def test_created_application_is_a_change() -> None:
    assert describes_change(None, Stage.APPLIED)


def test_deleted_application_is_a_change() -> None:
    assert describes_change(Stage.SCREEN, None)


def test_moving_to_another_stage_is_a_change() -> None:
    assert describes_change(Stage.APPLIED, Stage.SCREEN)


def test_no_stages_is_not_a_change() -> None:
    assert not describes_change(None, None)


def test_same_stage_is_not_a_change() -> None:
    assert not describes_change(Stage.INTERVIEW, Stage.INTERVIEW)

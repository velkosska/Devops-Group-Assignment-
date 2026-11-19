import pytest

from app.domain.stages import Stage, is_final


def test_stage_values_match_database_vocabulary() -> None:
    assert [s.value for s in Stage] == ["applied", "screen", "interview", "offer", "rejected"]


@pytest.mark.parametrize("stage", [Stage.OFFER, Stage.REJECTED])
def test_offer_and_rejected_are_final(stage: Stage) -> None:
    assert is_final(stage)


@pytest.mark.parametrize("stage", [Stage.APPLIED, Stage.SCREEN, Stage.INTERVIEW])
def test_other_stages_are_not_final(stage: Stage) -> None:
    assert not is_final(stage)

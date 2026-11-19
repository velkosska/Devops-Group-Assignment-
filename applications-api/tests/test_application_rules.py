import pytest

from app.domain.applications import (
    ApplicationError,
    move_stage,
    normalize_required_text,
    stage_for_new_application,
    validate_application,
    validate_details,
)
from app.domain.stages import Stage, is_final


def test_company_and_role_are_trimmed() -> None:
    company, role = validate_details("  Acme Corp  ", "  Backend Engineer  ")

    assert company == "Acme Corp"
    assert role == "Backend Engineer"


@pytest.mark.parametrize("value", [None, "", "   ", "\n\t"])
def test_company_is_required(value: str | None) -> None:
    with pytest.raises(ApplicationError, match="company is required"):
        normalize_required_text(value, "company")


@pytest.mark.parametrize("value", [None, "", "   "])
def test_role_is_required(value: str | None) -> None:
    with pytest.raises(ApplicationError, match="role is required"):
        validate_details("Acme", value)


def test_new_application_defaults_to_applied() -> None:
    details = validate_application("Acme", "Engineer")

    assert details.company == "Acme"
    assert details.role == "Engineer"
    assert details.stage is Stage.APPLIED


def test_new_application_rejects_a_blank_company() -> None:
    with pytest.raises(ApplicationError, match="company is required"):
        validate_application("   ", "Engineer", Stage.SCREEN)


@pytest.mark.parametrize("stage", list(Stage))
def test_new_application_accepts_every_existing_stage(stage: Stage) -> None:
    details = validate_application("Acme", "Engineer", stage.value)

    assert details.stage is stage
    assert type(details.stage) is Stage


def test_new_application_strips_a_stage_value() -> None:
    assert stage_for_new_application("  interview  ") is Stage.INTERVIEW


@pytest.mark.parametrize("value", ["", "   ", "hired", "APPLIED", "phone screen"])
def test_unknown_or_blank_stage_is_rejected(value: str) -> None:
    with pytest.raises(ApplicationError, match="stage"):
        stage_for_new_application(value)


def test_stage_error_lists_the_enum_values() -> None:
    with pytest.raises(
        ApplicationError,
        match="stage must be one of: applied, screen, interview, offer, rejected",
    ):
        stage_for_new_application("hired")


def test_non_text_stage_is_rejected() -> None:
    with pytest.raises(ApplicationError, match="stage must be one of"):
        move_stage(Stage.APPLIED, 3)  # type: ignore[arg-type]


def test_missing_stage_is_rejected_when_a_move_requires_one() -> None:
    with pytest.raises(ApplicationError, match="stage is required"):
        move_stage(None, Stage.SCREEN)


@pytest.mark.parametrize("current", list(Stage))
@pytest.mark.parametrize("target", list(Stage))
def test_any_different_stage_is_allowed_and_the_same_stage_is_not(
    current: Stage, target: Stage
) -> None:
    if current == target:
        with pytest.raises(ApplicationError, match="different stage"):
            move_stage(current, target)
    else:
        assert move_stage(current, target) is target


def test_backwards_and_leaving_a_final_stage_are_allowed() -> None:
    assert is_final(Stage.OFFER)
    assert is_final(Stage.REJECTED)

    assert move_stage(Stage.OFFER, Stage.INTERVIEW) is Stage.INTERVIEW
    assert move_stage("rejected", "applied") is Stage.APPLIED
    assert move_stage(Stage.APPLIED, Stage.OFFER) is Stage.OFFER

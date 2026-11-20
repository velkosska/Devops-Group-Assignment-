from datetime import datetime

import pytest
from pydantic import ValidationError

from app.domain.stages import Stage
from app.schemas.applications import (
    ApplicationResponse,
    CreateApplicationRequest,
    StageChangeRequest,
    UpdateApplicationRequest,
)


def test_create_trims_required_text_and_defaults_the_stage() -> None:
    created = CreateApplicationRequest(company="  Spotify  ", role="  Data Engineer  ")

    assert created.company == "Spotify"
    assert created.role == "Data Engineer"
    assert created.stage is Stage.APPLIED
    assert created.model_dump(mode="json")["stage"] == "applied"


def test_create_accepts_a_stage_and_trims_optional_text() -> None:
    created = CreateApplicationRequest(
        company="Spotify",
        role="Data Engineer",
        stage="  interview  ",
        url="  https://jobs.example  ",
        location="  Berlin  ",
        salary_range="  70-90k  ",
        applied_at="2026-11-01T09:00:00",
    )

    assert created.stage is Stage.INTERVIEW
    assert created.url == "https://jobs.example"
    assert created.location == "Berlin"
    assert created.salary_range == "70-90k"
    assert created.applied_at == datetime(2026, 11, 1, 9, 0, 0)


@pytest.mark.parametrize("value", [None, "", "   "])
def test_blank_optional_text_is_absent(value: str | None) -> None:
    created = CreateApplicationRequest(
        company="Spotify",
        role="Data Engineer",
        url=value,
        location=value,
        salary_range=value,
    )

    assert created.url is None
    assert created.location is None
    assert created.salary_range is None


def test_explicit_null_stage_on_create_starts_at_applied() -> None:
    created = CreateApplicationRequest(company="Spotify", role="Data Engineer", stage=None)

    assert created.stage is Stage.APPLIED


@pytest.mark.parametrize("field", ["company", "role"])
@pytest.mark.parametrize("value", ["", "   "])
def test_create_rejects_blank_company_or_role(field: str, value: str) -> None:
    body = {"company": "Spotify", "role": "Data Engineer", field: value}

    with pytest.raises(ValidationError, match=f"{field} is required"):
        CreateApplicationRequest.model_validate(body)


def test_create_rejects_a_missing_company_before_the_domain_rule() -> None:
    with pytest.raises(ValidationError, match="Field required"):
        CreateApplicationRequest.model_validate({"role": "Data Engineer"})


def test_create_rejects_an_unknown_stage() -> None:
    with pytest.raises(ValidationError, match="stage must be one of"):
        CreateApplicationRequest(company="Spotify", role="Data Engineer", stage="hired")


def test_create_rejects_a_non_text_stage() -> None:
    with pytest.raises(ValidationError, match="stage must be one of"):
        CreateApplicationRequest(company="Spotify", role="Data Engineer", stage=3)


def test_create_rejects_a_bad_applied_date() -> None:
    with pytest.raises(ValidationError, match="applied_at"):
        CreateApplicationRequest(
            company="Spotify",
            role="Data Engineer",
            applied_at="next week",
        )


def test_update_replaces_details_and_has_no_stage_field() -> None:
    updated = UpdateApplicationRequest.model_validate(
        {
            "company": "  Spotify  ",
            "role": " Backend Engineer ",
            "url": "   ",
            "stage": "offer",
        }
    )

    assert updated.company == "Spotify"
    assert updated.role == "Backend Engineer"
    assert updated.url is None
    assert "stage" not in UpdateApplicationRequest.model_fields
    assert "stage" not in updated.model_dump()


def test_update_rejects_a_blank_role() -> None:
    with pytest.raises(ValidationError, match="role is required"):
        UpdateApplicationRequest(company="Spotify", role=" ")


def test_stage_change_accepts_a_destination_without_the_current_stage() -> None:
    change = StageChangeRequest(stage=" screen ")

    assert set(StageChangeRequest.model_fields) == {"stage"}
    assert change.stage is Stage.SCREEN
    assert change.model_dump(mode="json") == {"stage": "screen"}


def test_stage_change_rejects_an_unknown_stage() -> None:
    with pytest.raises(ValidationError, match="stage must be one of"):
        StageChangeRequest(stage="hired")


def test_stage_change_rejects_a_non_text_stage() -> None:
    with pytest.raises(ValidationError, match="stage must be one of"):
        StageChangeRequest(stage=3)


def test_stage_change_rejects_a_null_stage() -> None:
    with pytest.raises(ValidationError, match="stage is required"):
        StageChangeRequest(stage=None)


def test_stage_change_rejects_a_missing_stage() -> None:
    with pytest.raises(ValidationError, match="Field required"):
        StageChangeRequest()


def test_response_serializes_the_contract_including_id() -> None:
    created_at = datetime(2026, 11, 20, 12, 0, 0)
    updated_at = datetime(2026, 11, 20, 12, 30, 0)
    application = ApplicationResponse(
        id=1,
        company="  Spotify  ",
        role=" Data Engineer ",
        stage=Stage.SCREEN,
        url=None,
        created_at=created_at,
        updated_at=updated_at,
    )

    dumped = application.model_dump(mode="json")

    assert dumped["id"] == 1
    assert dumped["company"] == "Spotify"
    assert dumped["stage"] == "screen"
    assert dumped["url"] is None
    assert dumped["created_at"] == "2026-11-20T12:00:00"
    assert dumped["updated_at"] == "2026-11-20T12:30:00"


def test_response_rejects_an_id_that_is_not_positive() -> None:
    with pytest.raises(ValidationError, match="greater than 0"):
        ApplicationResponse(
            id=0,
            company="Spotify",
            role="Data Engineer",
            stage="applied",
            created_at=datetime(2026, 11, 20, 12, 0, 0),
            updated_at=datetime(2026, 11, 20, 12, 0, 0),
        )

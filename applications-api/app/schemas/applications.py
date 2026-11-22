"""JSON shapes for a job application.

These models are the HTTP contract. They call the domain rules and do not
talk to FastAPI routes or the database.
"""

from datetime import datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.domain.applications import (
    COMPANY_MAX_LENGTH,
    LOCATION_MAX_LENGTH,
    ROLE_MAX_LENGTH,
    SALARY_RANGE_MAX_LENGTH,
    URL_MAX_LENGTH,
    ApplicationError,
    coerce_stage,
    ensure_fits,
    ensure_optional_fits,
    normalize_optional_text,
    normalize_required_text,
    stage_for_new_application,
)
from app.domain.stages import Stage

_REQUIRED_LIMITS = {"company": COMPANY_MAX_LENGTH, "role": ROLE_MAX_LENGTH}
_OPTIONAL_LIMITS = {
    "url": URL_MAX_LENGTH,
    "location": LOCATION_MAX_LENGTH,
    "salary_range": SALARY_RANGE_MAX_LENGTH,
}


def _required_text(value: str, info: ValidationInfo) -> str:
    field_name = info.field_name or "field"
    text = normalize_required_text(value, field_name)
    return ensure_fits(text, field_name, _REQUIRED_LIMITS[field_name])


def _optional_text(value: str | None, info: ValidationInfo) -> str | None:
    field_name = info.field_name or "field"
    text = normalize_optional_text(value)
    return ensure_optional_fits(text, field_name, _OPTIONAL_LIMITS[field_name])


def _stage_for_create(value: object) -> Stage:
    """Stage on a new application. Omitted or null means applied."""
    if value is None or isinstance(value, Stage | str):
        return stage_for_new_application(value)
    allowed = ", ".join(stage.value for stage in Stage)
    raise ApplicationError(f"stage must be one of: {allowed}")


def _target_stage(value: object) -> Stage:
    """Stage sent by PATCH. There is no current stage to compare it with."""
    if value is None or isinstance(value, Stage | str):
        return coerce_stage(value)
    allowed = ", ".join(stage.value for stage in Stage)
    raise ApplicationError(f"stage must be one of: {allowed}")


class CreateApplicationRequest(BaseModel):
    """Body for creating an application. An omitted stage starts at applied."""

    company: str
    role: str
    stage: Stage = Stage.APPLIED
    url: str | None = None
    location: str | None = None
    salary_range: str | None = None
    applied_at: datetime | None = None

    @field_validator("company", "role")
    @classmethod
    def company_and_role_are_required(cls, value: str, info: ValidationInfo) -> str:
        return _required_text(value, info)

    @field_validator("stage", mode="before")
    @classmethod
    def stage_uses_the_domain_rule(cls, value: object) -> Stage:
        return _stage_for_create(value)

    @field_validator("url", "location", "salary_range")
    @classmethod
    def optional_text_is_trimmed(cls, value: str | None, info: ValidationInfo) -> str | None:
        return _optional_text(value, info)


class UpdateApplicationRequest(BaseModel):
    """Body for PUT. It replaces the editable details and does not move the stage."""

    company: str
    role: str
    url: str | None = None
    location: str | None = None
    salary_range: str | None = None
    applied_at: datetime | None = None

    @field_validator("company", "role")
    @classmethod
    def company_and_role_are_required(cls, value: str, info: ValidationInfo) -> str:
        return _required_text(value, info)

    @field_validator("url", "location", "salary_range")
    @classmethod
    def optional_text_is_trimmed(cls, value: str | None, info: ValidationInfo) -> str | None:
        return _optional_text(value, info)


class StageChangeRequest(BaseModel):
    """Body for PATCH. Only the destination stage; the current one is not here."""

    stage: Stage

    @field_validator("stage", mode="before")
    @classmethod
    def stage_must_be_known(cls, value: object) -> Stage:
        return _target_stage(value)


class ApplicationResponse(BaseModel):
    """Application JSON returned to the board.

    `id` is part of that contract. A caller can fill it in before a database
    exists, which is how the schema is tested.
    """

    id: int = Field(gt=0)
    company: str
    role: str
    stage: Stage
    url: str | None = None
    location: str | None = None
    salary_range: str | None = None
    applied_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("company", "role")
    @classmethod
    def company_and_role_are_required(cls, value: str, info: ValidationInfo) -> str:
        return _required_text(value, info)

    @field_validator("stage", mode="before")
    @classmethod
    def stage_must_be_known(cls, value: object) -> Stage:
        return _target_stage(value)

    @field_validator("url", "location", "salary_range")
    @classmethod
    def optional_text_is_trimmed(cls, value: str | None, info: ValidationInfo) -> str | None:
        return _optional_text(value, info)

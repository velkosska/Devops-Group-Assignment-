"""JSON shapes for a job application.

These models are the HTTP contract. They call the domain rules and do not
talk to FastAPI routes or the database.
"""

from datetime import datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.domain.applications import (
    ApplicationError,
    coerce_stage,
    normalize_required_text,
    stage_for_new_application,
)
from app.domain.stages import Stage


def _required_text(value: str, info: ValidationInfo) -> str:
    return normalize_required_text(value, info.field_name or "field")


def _optional_text(value: str | None) -> str | None:
    """Trim an optional column. Blank text is treated as absent."""
    if value is None:
        return None
    stripped = value.strip()
    if stripped == "":
        return None
    return stripped


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
    def optional_text_is_trimmed(cls, value: str | None) -> str | None:
        return _optional_text(value)


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
    def optional_text_is_trimmed(cls, value: str | None) -> str | None:
        return _optional_text(value)


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
    def optional_text_is_trimmed(cls, value: str | None) -> str | None:
        return _optional_text(value)

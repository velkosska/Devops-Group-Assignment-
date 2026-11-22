"""Validation and stage rules for a job application.

Pure functions: no FastAPI, SQLAlchemy or network calls. Routes and services
will call these so the same rules apply no matter how the data arrives.
"""

from dataclasses import dataclass

from app.domain.stages import Stage

_ALLOWED_STAGES = ", ".join(stage.value for stage in Stage)


class ApplicationError(ValueError):
    """A job application broke a domain rule.

    The message is safe to show to the user. It does not include internals.
    """


@dataclass(frozen=True)
class ApplicationDetails:
    """Company, role and stage after validation. This is not a database row."""

    company: str
    role: str
    stage: Stage


# These match migration 0001. A longer value would be rejected by the database.
COMPANY_MAX_LENGTH = 200
ROLE_MAX_LENGTH = 200
LOCATION_MAX_LENGTH = 200
SALARY_RANGE_MAX_LENGTH = 100
URL_MAX_LENGTH = 2048


def normalize_required_text(value: str | None, field_name: str) -> str:
    """Return the trimmed text, or raise if it was missing or blank."""
    if value is None or value.strip() == "":
        raise ApplicationError(f"{field_name} is required")
    return value.strip()


def normalize_optional_text(value: str | None) -> str | None:
    """Trim optional text. Blank text is treated as absent."""
    if value is None:
        return None
    stripped = value.strip()
    if stripped == "":
        return None
    return stripped


def ensure_fits(value: str, field_name: str, limit: int) -> str:
    """Reject text that cannot fit in the applications table."""
    if len(value) > limit:
        raise ApplicationError(f"{field_name} must be at most {limit} characters")
    return value


def ensure_optional_fits(value: str | None, field_name: str, limit: int) -> str | None:
    if value is None:
        return None
    return ensure_fits(value, field_name, limit)


def coerce_stage(value: Stage | str | None, *, default: Stage | None = None) -> Stage:
    """Turn a stage value into the shared Stage enum.

    None means the caller omitted the stage. That is allowed only when
    `default` is set, which is how a new application starts as applied.
    A blank or unknown value is always an error.
    """
    if value is None:
        if default is None:
            raise ApplicationError("stage is required")
        return default

    if isinstance(value, Stage):
        return value

    if not isinstance(value, str):
        raise ApplicationError(f"stage must be one of: {_ALLOWED_STAGES}")

    cleaned = value.strip()
    if cleaned == "":
        raise ApplicationError("stage is required")
    try:
        return Stage(cleaned)
    except ValueError as exc:
        raise ApplicationError(f"stage must be one of: {_ALLOWED_STAGES}") from exc


def validate_details(company: str | None, role: str | None) -> tuple[str, str]:
    """Check the two fields every application must have."""
    return (
        normalize_required_text(company, "company"),
        normalize_required_text(role, "role"),
    )


def stage_for_new_application(stage: Stage | str | None = None) -> Stage:
    """Stage for a new application. Omitting it means applied."""
    return coerce_stage(stage, default=Stage.APPLIED)


def validate_application(
    company: str | None,
    role: str | None,
    stage: Stage | str | None = None,
) -> ApplicationDetails:
    """Validate a new application. An omitted stage defaults to applied."""
    checked_company, checked_role = validate_details(company, role)
    return ApplicationDetails(
        company=checked_company,
        role=checked_role,
        stage=stage_for_new_application(stage),
    )


def move_stage(current: Stage | str | None, target: Stage | str | None) -> Stage:
    """Return the stage an application moves to.

    The proposal does not define a transition matrix. Any different stage
    is allowed, including backwards and leaving offer or rejected, so a
    mistaken card can be corrected. Staying on the same stage is not a change.
    """
    current_stage = coerce_stage(current)
    target_stage = coerce_stage(target)
    if current_stage == target_stage:
        raise ApplicationError("stage must change to a different stage")
    return target_stage

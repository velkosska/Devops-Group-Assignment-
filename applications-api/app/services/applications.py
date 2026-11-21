"""Use cases for a job application.

The service applies the domain rules and asks the repository to save the
result. It does not import SQLAlchemy or FastAPI.
"""

from datetime import datetime

from app.domain.applications import (
    COMPANY_MAX_LENGTH,
    LOCATION_MAX_LENGTH,
    ROLE_MAX_LENGTH,
    SALARY_RANGE_MAX_LENGTH,
    URL_MAX_LENGTH,
    coerce_stage,
    ensure_fits,
    ensure_optional_fits,
    move_stage,
    normalize_optional_text,
    validate_application,
    validate_details,
)
from app.domain.stages import Stage
from app.repositories.applications import ApplicationRecord, SqlApplicationRepository


class ApplicationNotFound(LookupError):
    """No application has this id. A route can turn this into HTTP 404."""


class ApplicationService:
    """Create, list, read, edit, move and delete one person's applications."""

    def __init__(self, repository: SqlApplicationRepository) -> None:
        self._repository = repository

    def create(
        self,
        company: str | None,
        role: str | None,
        stage: Stage | str | None = None,
        url: str | None = None,
        location: str | None = None,
        salary_range: str | None = None,
        applied_at: datetime | None = None,
    ) -> ApplicationRecord:
        details = validate_application(company, role, stage)
        return self._repository.add(
            company=ensure_fits(details.company, "company", COMPANY_MAX_LENGTH),
            role=ensure_fits(details.role, "role", ROLE_MAX_LENGTH),
            stage=details.stage,
            url=self._optional(url, "url", URL_MAX_LENGTH),
            location=self._optional(location, "location", LOCATION_MAX_LENGTH),
            salary_range=self._optional(salary_range, "salary_range", SALARY_RANGE_MAX_LENGTH),
            applied_at=applied_at,
        )

    def get(self, application_id: int) -> ApplicationRecord:
        return self._require(application_id)

    def list_applications(self, stage: Stage | str | None = None) -> list[ApplicationRecord]:
        selected = None if stage is None else coerce_stage(stage)
        return self._repository.list_applications(selected)

    def update(
        self,
        application_id: int,
        company: str | None,
        role: str | None,
        url: str | None = None,
        location: str | None = None,
        salary_range: str | None = None,
        applied_at: datetime | None = None,
    ) -> ApplicationRecord:
        self._require(application_id)
        checked_company, checked_role = validate_details(company, role)
        updated = self._repository.update_details(
            application_id,
            company=ensure_fits(checked_company, "company", COMPANY_MAX_LENGTH),
            role=ensure_fits(checked_role, "role", ROLE_MAX_LENGTH),
            url=self._optional(url, "url", URL_MAX_LENGTH),
            location=self._optional(location, "location", LOCATION_MAX_LENGTH),
            salary_range=self._optional(salary_range, "salary_range", SALARY_RANGE_MAX_LENGTH),
            applied_at=applied_at,
        )
        if updated is None:
            raise ApplicationNotFound(f"application {application_id} was not found")
        return updated

    def change_stage(self, application_id: int, stage: Stage | str) -> ApplicationRecord:
        current = self._require(application_id)
        target = move_stage(current.stage, stage)
        updated = self._repository.update_stage(application_id, target)
        if updated is None:
            raise ApplicationNotFound(f"application {application_id} was not found")
        return updated

    def delete(self, application_id: int) -> None:
        self._require(application_id)
        if not self._repository.delete(application_id):
            raise ApplicationNotFound(f"application {application_id} was not found")

    def _require(self, application_id: int) -> ApplicationRecord:
        found = self._repository.get(application_id)
        if found is None:
            raise ApplicationNotFound(f"application {application_id} was not found")
        return found

    @staticmethod
    def _optional(value: str | None, field_name: str, limit: int) -> str | None:
        return ensure_optional_fits(normalize_optional_text(value), field_name, limit)

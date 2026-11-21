"""SQL for the applications table created by migration 0001.

This is the only module that talks to that table. It returns plain records,
not ORM objects, and it does not decide whether a stage move is allowed.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.dialects.mssql import DATETIMEOFFSET
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.domain.stages import Stage

# Same timestamp type as migration 0001. The migration creates the column.
TIMESTAMP = DateTime(timezone=True).with_variant(DATETIMEOFFSET(), "mssql")


class Base(DeclarativeBase):
    pass


class ApplicationRow(Base):
    """Mapping of the existing applications table. This does not create it."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(2048))
    stage: Mapped[str] = mapped_column(String(20))
    location: Mapped[str | None] = mapped_column(String(200))
    salary_range: Mapped[str | None] = mapped_column(String(100))
    applied_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)


@dataclass(frozen=True)
class ApplicationRecord:
    """One saved application. This is the value the service returns."""

    id: int
    company: str
    role: str
    stage: Stage
    url: str | None
    location: str | None
    salary_range: str | None
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _to_record(row: ApplicationRow) -> ApplicationRecord:
    # SQLite gives back naive datetimes. Treat those as UTC, matching SQL Server.
    return ApplicationRecord(
        id=row.id,
        company=row.company,
        role=row.role,
        stage=Stage(row.stage),
        url=row.url,
        location=row.location,
        salary_range=row.salary_range,
        applied_at=None if row.applied_at is None else _as_utc(row.applied_at),
        created_at=_as_utc(row.created_at),
        updated_at=_as_utc(row.updated_at),
    )


class SqlApplicationRepository:
    """Inserts, reads, updates and deletes rows in the applications table."""

    def __init__(self, session: Session, clock: Callable[[], datetime] | None = None) -> None:
        self._session = session
        self._clock = clock or (lambda: datetime.now(UTC))

    def add(
        self,
        *,
        company: str,
        role: str,
        stage: Stage,
        url: str | None,
        location: str | None,
        salary_range: str | None,
        applied_at: datetime | None,
    ) -> ApplicationRecord:
        now = self._clock()
        row = ApplicationRow(
            company=company,
            role=role,
            stage=stage.value,
            url=url,
            location=location,
            salary_range=salary_range,
            applied_at=None if applied_at is None else _as_utc(applied_at),
            created_at=now,
            updated_at=now,
        )
        return self._commit_row(row, new=True)

    def get(self, application_id: int) -> ApplicationRecord | None:
        row = self._session.get(ApplicationRow, application_id)
        if row is None:
            return None
        return _to_record(row)

    def list_applications(self, stage: Stage | None = None) -> list[ApplicationRecord]:
        statement = select(ApplicationRow).order_by(ApplicationRow.id)
        if stage is not None:
            statement = statement.where(ApplicationRow.stage == stage.value)
        return [_to_record(row) for row in self._session.scalars(statement)]

    def update_details(
        self,
        application_id: int,
        *,
        company: str,
        role: str,
        url: str | None,
        location: str | None,
        salary_range: str | None,
        applied_at: datetime | None,
    ) -> ApplicationRecord | None:
        row = self._session.get(ApplicationRow, application_id)
        if row is None:
            return None
        row.company = company
        row.role = role
        row.url = url
        row.location = location
        row.salary_range = salary_range
        row.applied_at = None if applied_at is None else _as_utc(applied_at)
        row.updated_at = self._clock()
        return self._commit_row(row)

    def update_stage(self, application_id: int, stage: Stage) -> ApplicationRecord | None:
        row = self._session.get(ApplicationRow, application_id)
        if row is None:
            return None
        row.stage = stage.value
        row.updated_at = self._clock()
        return self._commit_row(row)

    def delete(self, application_id: int) -> bool:
        row = self._session.get(ApplicationRow, application_id)
        if row is None:
            return False
        self._session.delete(row)
        self._commit()
        return True

    def _commit_row(self, row: ApplicationRow, *, new: bool = False) -> ApplicationRecord:
        if new:
            self._session.add(row)
        try:
            self._session.flush()
            record = _to_record(row)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise
        return record

    def _commit(self) -> None:
        try:
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

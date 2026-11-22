from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, String, Uuid, select
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.domain.stages import Stage


class Base(DeclarativeBase):
    pass


class StageEventRecord(Base):
    __tablename__ = "stage_events"

    sequence: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[UUID] = mapped_column(Uuid, unique=True)
    application_id: Mapped[int] = mapped_column(BigInteger)
    from_stage: Mapped[str | None] = mapped_column(String(16))
    to_stage: Mapped[str | None] = mapped_column(String(16))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime().with_variant(DATETIME2(precision=6), "mssql")
    )


class EventConflictError(ValueError):
    pass


def store_event(
    session: Session,
    event_id: UUID,
    application_id: int,
    from_stage: Stage | None,
    to_stage: Stage | None,
    occurred_at: datetime,
) -> None:
    # DATETIME2 stores UTC wall time. Offset conversion happens at the request boundary.
    occurred_at = occurred_at.astimezone(UTC).replace(tzinfo=None)
    fields = {
        "application_id": application_id,
        "from_stage": from_stage,
        "to_stage": to_stage,
        "occurred_at": occurred_at,
    }
    try:
        with session.begin():
            session.add(StageEventRecord(event_id=event_id, **fields))
    except IntegrityError:
        # The unique constraint settles concurrent attempts before we compare payloads.
        existing = session.scalar(
            select(StageEventRecord).where(StageEventRecord.event_id == event_id)
        )
        if existing is None:
            raise
        if any(getattr(existing, key) != value for key, value in fields.items()):
            raise EventConflictError from None


def read_events(session: Session):
    statement = select(StageEventRecord).order_by(
        StageEventRecord.application_id, StageEventRecord.occurred_at, StageEventRecord.sequence
    )
    return session.scalars(statement.execution_options(yield_per=500))

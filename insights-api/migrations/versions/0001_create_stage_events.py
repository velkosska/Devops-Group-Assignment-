import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mssql import DATETIME2

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stage_events",
        sa.Column("sequence", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.BigInteger(), nullable=False),
        sa.Column("from_stage", sa.String(16)),
        sa.Column("to_stage", sa.String(16)),
        sa.Column(
            "occurred_at",
            sa.DateTime().with_variant(DATETIME2(precision=6), "mssql"),
            nullable=False,
        ),
        sa.UniqueConstraint("event_id", name="uq_stage_events_event_id"),
    )
    op.create_index(
        "ix_stage_events_history", "stage_events", ["application_id", "occurred_at", "sequence"]
    )


def downgrade() -> None:
    op.drop_table("stage_events")

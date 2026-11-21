"""create applications table

Revision ID: 0001
Revises:
Create Date: 2026-11-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mssql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Timestamps are stored with a time zone. SQL Server needs DATETIMEOFFSET for that.
TIMESTAMP = sa.DateTime(timezone=True).with_variant(mssql.DATETIMEOFFSET(), "mssql")

# Written out in full on purpose: a migration must not change when app code changes.
STAGES = ("applied", "screen", "interview", "offer", "rejected")


def upgrade() -> None:
    stage_list = ", ".join(f"'{stage}'" for stage in STAGES)
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company", sa.String(200), nullable=False),
        sa.Column("role", sa.String(200), nullable=False),
        sa.Column("url", sa.String(2048), nullable=True),
        sa.Column("stage", sa.String(20), nullable=False, server_default="applied"),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("salary_range", sa.String(100), nullable=True),
        sa.Column("applied_at", TIMESTAMP, nullable=True),
        sa.Column(
            "created_at", TIMESTAMP, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column(
            "updated_at", TIMESTAMP, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.CheckConstraint(f"stage IN ({stage_list})", name="ck_applications_stage"),
    )
    op.create_index("ix_applications_stage", "applications", ["stage"])


def downgrade() -> None:
    op.drop_index("ix_applications_stage", table_name="applications")
    op.drop_table("applications")

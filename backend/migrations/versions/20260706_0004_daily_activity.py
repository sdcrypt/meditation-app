"""Record listening activity for timezone-aware progress.

Revision ID: 20260706_0004
Revises: 20260705_0003
Create Date: 2026-07-06
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260706_0004"
down_revision: str | None = "20260705_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "meditation_sessions",
        sa.Column("last_listened_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "meditation_session_activity",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("seconds_listened", sa.Integer(), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["meditation_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_meditation_session_activity_session_id",
        "meditation_session_activity",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_meditation_session_activity_session_id",
        table_name="meditation_session_activity",
    )
    op.drop_table("meditation_session_activity")
    op.drop_column("meditation_sessions", "last_listened_at")

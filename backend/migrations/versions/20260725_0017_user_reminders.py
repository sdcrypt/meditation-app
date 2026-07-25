"""add user reminder preferences

Revision ID: 20260725_0017
Revises: 20260723_0016
Create Date: 2026-07-25 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260725_0017"
down_revision: Union[str, None] = "20260723_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the table that stores email reminder settings."""
    op.create_table(
        "user_reminder_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("reminder_time", sa.Time(timezone=False), nullable=False),
        sa.Column("frequency", sa.String(), server_default="daily", nullable=False),
        sa.Column("timezone", sa.String(), server_default="UTC", nullable=False),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_reminder_preferences_user_id"),
        "user_reminder_preferences",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    """Remove saved email reminder settings."""
    op.drop_index(op.f("ix_user_reminder_preferences_user_id"), table_name="user_reminder_preferences")
    op.drop_table("user_reminder_preferences")

"""Store meditations saved by users.

Revision ID: 20260708_0008
Revises: 20260708_0007
Create Date: 2026-07-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260708_0008"
down_revision: str | None = "20260708_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the table that stores saved meditations."""
    op.create_table(
        "user_favorites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("meditation_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["meditation_id"], ["meditations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "meditation_id", name="uq_user_favorite"),
    )
    op.create_index(
        "ix_user_favorites_meditation_id",
        "user_favorites",
        ["meditation_id"],
        unique=False,
    )
    op.create_index(
        "ix_user_favorites_user_id",
        "user_favorites",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the saved meditations table."""
    op.drop_index("ix_user_favorites_user_id", table_name="user_favorites")
    op.drop_index("ix_user_favorites_meditation_id", table_name="user_favorites")
    op.drop_table("user_favorites")

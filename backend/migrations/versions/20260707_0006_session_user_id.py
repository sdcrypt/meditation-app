"""Connect listening sessions to signed-in users.

Revision ID: 20260707_0006
Revises: 20260707_0005
Create Date: 2026-07-07
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260707_0006"
down_revision: str | None = "20260707_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add an optional account owner to listening sessions."""
    op.add_column(
        "meditation_sessions",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_meditation_sessions_user_id_users",
        "meditation_sessions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_meditation_sessions_user_id",
        "meditation_sessions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the account owner from listening sessions."""
    op.drop_index("ix_meditation_sessions_user_id", table_name="meditation_sessions")
    op.drop_constraint(
        "fk_meditation_sessions_user_id_users",
        "meditation_sessions",
        type_="foreignkey",
    )
    op.drop_column("meditation_sessions", "user_id")

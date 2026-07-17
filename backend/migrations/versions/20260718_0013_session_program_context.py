"""Add program context to meditation sessions.

Revision ID: 20260718_0013
Revises: 20260710_0012
Create Date: 2026-07-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260718_0013"
down_revision: str | None = "20260710_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Store the program that launched a listening session."""
    op.add_column(
        "meditation_sessions",
        sa.Column("program_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_meditation_sessions_program_id",
        "meditation_sessions",
        ["program_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_meditation_sessions_program_id_programs",
        "meditation_sessions",
        "programs",
        ["program_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Remove program context from listening sessions."""
    op.drop_constraint(
        "fk_meditation_sessions_program_id_programs",
        "meditation_sessions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_meditation_sessions_program_id",
        table_name="meditation_sessions",
    )
    op.drop_column("meditation_sessions", "program_id")

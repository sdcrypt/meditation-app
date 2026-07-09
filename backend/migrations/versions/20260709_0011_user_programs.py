"""Store programs started by users.

Revision ID: 20260709_0011
Revises: 20260709_0010
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260709_0011"
down_revision: str | None = "20260709_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the table that records started programs."""
    op.create_table(
        "user_programs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "program_id", name="uq_user_program"),
    )
    op.create_index("ix_user_programs_program_id", "user_programs", ["program_id"], unique=False)
    op.create_index("ix_user_programs_user_id", "user_programs", ["user_id"], unique=False)


def downgrade() -> None:
    """Remove the table that records started programs."""
    op.drop_index("ix_user_programs_user_id", table_name="user_programs")
    op.drop_index("ix_user_programs_program_id", table_name="user_programs")
    op.drop_table("user_programs")

"""Track playback position independently from listened time.

Revision ID: 20260705_0003
Revises: 20260704_0002
Create Date: 2026-07-05
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260705_0003"
down_revision: str | None = "20260704_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "meditation_sessions",
        "seconds_listened",
        existing_type=sa.Integer(),
        server_default=sa.text("0"),
        nullable=False,
    )
    op.add_column(
        "meditation_sessions",
        sa.Column(
            "last_position_sec",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("meditation_sessions", "last_position_sec")
    op.alter_column(
        "meditation_sessions",
        "seconds_listened",
        existing_type=sa.Integer(),
        server_default=None,
        nullable=True,
    )

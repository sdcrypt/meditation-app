"""Advance the program id sequence after starter program seed data.

Revision ID: 20260709_0010
Revises: 20260709_0009
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260709_0010"
down_revision: str | None = "20260709_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Move the next program id above existing seeded programs."""
    op.execute(
        sa.text(
            "SELECT setval(pg_get_serial_sequence('programs', 'id'), "
            "(SELECT COALESCE(MAX(id), 1) FROM programs))"
        )
    )


def downgrade() -> None:
    """Leave the sequence unchanged when rolling back this safety fix."""
    pass

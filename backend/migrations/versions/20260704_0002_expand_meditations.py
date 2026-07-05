"""Add content and discovery metadata to meditations.

Revision ID: 20260704_0002
Revises: 20260704_0001
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260704_0002"
down_revision: str | None = "20260704_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "meditations",
        sa.Column("description", sa.Text(), server_default="", nullable=False),
    )
    op.add_column(
        "meditations",
        sa.Column("teacher_name", sa.String(), server_default="", nullable=False),
    )
    op.add_column(
        "meditations",
        sa.Column("artwork_url", sa.String(), nullable=True),
    )
    op.add_column(
        "meditations",
        sa.Column(
            "tags",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "meditations",
        sa.Column(
            "benefits",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "meditations",
        sa.Column(
            "is_featured",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "meditations",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.alter_column(
        "meditations",
        "is_published",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "meditations",
        "is_published",
        existing_type=sa.Boolean(),
        server_default=None,
        nullable=True,
    )
    op.drop_column("meditations", "created_at")
    op.drop_column("meditations", "is_featured")
    op.drop_column("meditations", "benefits")
    op.drop_column("meditations", "tags")
    op.drop_column("meditations", "artwork_url")
    op.drop_column("meditations", "teacher_name")
    op.drop_column("meditations", "description")

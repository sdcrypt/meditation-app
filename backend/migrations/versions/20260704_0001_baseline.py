"""Create the initial application schema.

This baseline is adoption-safe: databases previously initialized through
SQLAlchemy create_all keep their existing tables and data, while fresh
databases receive the complete schema.

Revision ID: 20260704_0001
Revises:
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260704_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the original tables when they do not already exist."""
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.Column("is_admin", sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    if "meditations" not in existing_tables:
        op.create_table(
            "meditations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("category", sa.String(), nullable=False),
            sa.Column("duration_sec", sa.Integer(), nullable=False),
            sa.Column("level", sa.String(), nullable=False),
            sa.Column("audio_url", sa.String(), nullable=True),
            sa.Column("is_published", sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_meditations_id", "meditations", ["id"], unique=False)

    if "meditation_sessions" not in existing_tables:
        op.create_table(
            "meditation_sessions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("meditation_id", sa.Integer(), nullable=True),
            sa.Column("device_id", sa.Integer(), nullable=True),
            sa.Column(
                "started_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("seconds_listened", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["meditation_id"], ["meditations.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    """Remove the original application tables."""
    op.drop_table("meditation_sessions")
    op.drop_index("ix_meditations_id", table_name="meditations")
    op.drop_table("meditations")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

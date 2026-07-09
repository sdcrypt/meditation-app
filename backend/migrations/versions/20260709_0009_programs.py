"""Create meditation programs and ordered program items.

Revision ID: 20260709_0009
Revises: 20260708_0008
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260709_0009"
down_revision: str | None = "20260708_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create program tables and starter programs."""
    op.create_table(
        "programs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("artwork_url", sa.String(), nullable=True),
        sa.Column("level", sa.String(), server_default="beginner", nullable=False),
        sa.Column("goal", sa.String(), server_default="", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "program_meditations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=False),
        sa.Column("meditation_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["meditation_id"], ["meditations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_id", "meditation_id", name="uq_program_meditation"),
        sa.UniqueConstraint("program_id", "position", name="uq_program_position"),
    )
    op.create_index("ix_program_meditations_meditation_id", "program_meditations", ["meditation_id"], unique=False)
    op.create_index("ix_program_meditations_program_id", "program_meditations", ["program_id"], unique=False)

    programs = sa.table(
        "programs",
        sa.column("id", sa.Integer),
        sa.column("title", sa.String),
        sa.column("description", sa.Text),
        sa.column("level", sa.String),
        sa.column("goal", sa.String),
        sa.column("is_published", sa.Boolean),
    )
    op.bulk_insert(
        programs,
        [
            {
                "id": 1,
                "title": "7 Days of Calm",
                "description": "A gentle first-week path for building a steady daily pause with breath, stillness, and simple awareness.",
                "level": "beginner",
                "goal": "stress",
                "is_published": True,
            },
            {
                "id": 2,
                "title": "Sleep Reset",
                "description": "A soothing evening sequence designed to quiet the mind, soften the body, and prepare for deeper rest.",
                "level": "all levels",
                "goal": "sleep",
                "is_published": True,
            },
            {
                "id": 3,
                "title": "Beginner Mindfulness",
                "description": "A clear introduction to mindful listening, present-moment attention, and returning gently when the mind wanders.",
                "level": "beginner",
                "goal": "mindfulness",
                "is_published": True,
            },
        ],
    )
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "SELECT setval(pg_get_serial_sequence('programs', 'id'), "
            "(SELECT COALESCE(MAX(id), 1) FROM programs))"
        )
    )

    meditation_ids = [
        row[0]
        for row in connection.execute(
            sa.text("SELECT id FROM meditations WHERE is_published = true ORDER BY id")
        )
    ]
    if meditation_ids:
        program_meditations = sa.table(
            "program_meditations",
            sa.column("program_id", sa.Integer),
            sa.column("meditation_id", sa.Integer),
            sa.column("position", sa.Integer),
        )
        rows = []
        for program_id in (1, 2, 3):
            for position, meditation_id in enumerate(meditation_ids, start=1):
                rows.append(
                    {
                        "program_id": program_id,
                        "meditation_id": meditation_id,
                        "position": position,
                    }
                )
        op.bulk_insert(program_meditations, rows)


def downgrade() -> None:
    """Remove program tables."""
    op.drop_index("ix_program_meditations_program_id", table_name="program_meditations")
    op.drop_index("ix_program_meditations_meditation_id", table_name="program_meditations")
    op.drop_table("program_meditations")
    op.drop_table("programs")

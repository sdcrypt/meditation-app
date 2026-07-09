"""Diversify starter program meditation sequences.

Revision ID: 20260710_0012
Revises: 20260709_0011
Create Date: 2026-07-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260710_0012"
down_revision: str | None = "20260709_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


STARTER_PROGRAMS = {
    1: "7 Days of Calm",
    2: "Sleep Reset",
    3: "Beginner Mindfulness",
}


def build_sequences(meditation_ids: list[int]) -> dict[int, list[int]]:
    """Create distinct starter paths while allowing useful overlap."""
    if len(meditation_ids) < 4:
        return {program_id: meditation_ids for program_id in STARTER_PROGRAMS}

    return {
        1: [meditation_ids[0], meditation_ids[1], meditation_ids[2]],
        2: [meditation_ids[1], meditation_ids[3], meditation_ids[0]],
        3: [meditation_ids[0], meditation_ids[2], meditation_ids[3]],
    }


def replace_program_items(
    connection,
    program_id: int,
    meditation_ids: list[int],
) -> None:
    """Replace one starter program sequence."""
    connection.execute(
        sa.text("DELETE FROM program_meditations WHERE program_id = :program_id"),
        {"program_id": program_id},
    )
    for position, meditation_id in enumerate(meditation_ids, start=1):
        connection.execute(
            sa.text(
                """
                INSERT INTO program_meditations (program_id, meditation_id, position)
                VALUES (:program_id, :meditation_id, :position)
                """
            ),
            {
                "program_id": program_id,
                "meditation_id": meditation_id,
                "position": position,
            },
        )


def upgrade() -> None:
    """Give the three starter programs different meditation paths."""
    connection = op.get_bind()
    starter_ids = {
        row[0]
        for row in connection.execute(
            sa.text(
                """
                SELECT id
                FROM programs
                WHERE id IN (1, 2, 3)
                AND title IN ('7 Days of Calm', 'Sleep Reset', 'Beginner Mindfulness')
                """
            )
        )
    }
    if starter_ids != set(STARTER_PROGRAMS):
        return

    meditation_ids = [
        row[0]
        for row in connection.execute(
            sa.text("SELECT id FROM meditations WHERE is_published = true ORDER BY id")
        )
    ]
    sequences = build_sequences(meditation_ids)
    for program_id, sequence in sequences.items():
        replace_program_items(connection, program_id, sequence)


def downgrade() -> None:
    """Restore the original starter paths used when programs were introduced."""
    connection = op.get_bind()
    meditation_ids = [
        row[0]
        for row in connection.execute(
            sa.text("SELECT id FROM meditations WHERE is_published = true ORDER BY id")
        )
    ]
    for program_id in STARTER_PROGRAMS:
        replace_program_items(connection, program_id, meditation_ids)

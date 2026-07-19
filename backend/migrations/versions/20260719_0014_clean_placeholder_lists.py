"""Remove placeholder values from meditation lists.

Revision ID: 20260719_0014
Revises: 20260718_0013
Create Date: 2026-07-19
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260719_0014"
down_revision: str | None = "20260718_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLACEHOLDER_SQL = "'[]', '{}', 'null', 'none', 'undefined', '-', 'n/a', 'na'"


def _clean_json_text_array(column_name: str) -> None:
    """Remove empty placeholder strings from an existing JSON text list."""
    op.execute(
        sa.text(
            f"""
            UPDATE meditations
            SET {column_name} = COALESCE((
                SELECT json_agg(cleaned_value)
                FROM (
                    SELECT trim(value) AS cleaned_value
                    FROM json_array_elements_text({column_name}) AS value
                    WHERE trim(value) <> ''
                    AND lower(trim(value)) NOT IN ({PLACEHOLDER_SQL})
                ) AS cleaned_values
            ), '[]'::json)
            WHERE {column_name} IS NOT NULL
            """
        )
    )


def upgrade() -> None:
    """Clean imported tags and benefits that were saved as placeholder text."""
    _clean_json_text_array("tags")
    _clean_json_text_array("benefits")


def downgrade() -> None:
    """Leave cleaned list values as-is when rolling back."""
    pass

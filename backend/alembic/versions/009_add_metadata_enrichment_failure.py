"""add metadata_enrichment_failure table

Revision ID: 009
Revises: 008
Create Date: 2025-03-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, Sequence[str], None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metadata_enrichment_failure",
        sa.Column("imdb_title_id", sa.String(20), primary_key=True),
        sa.Column("fail_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_failed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_error", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("metadata_enrichment_failure")

"""add country to title_metadata

Revision ID: 007
Revises: 006
Create Date: 2025-03-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, Sequence[str], None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("title_metadata", sa.Column("country", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("title_metadata", "country")

"""add genres to imdb_watchlist

Revision ID: 005
Revises: 004
Create Date: 2025-03-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, Sequence[str], None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("imdb_watchlist", sa.Column("genres", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("imdb_watchlist", "genres")

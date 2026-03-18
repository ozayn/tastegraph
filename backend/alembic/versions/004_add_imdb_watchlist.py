"""add imdb_watchlist table

Revision ID: 004
Revises: 003
Create Date: 2025-03-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, Sequence[str], None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "imdb_watchlist",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("imdb_title_id", sa.String(20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created", sa.Date(), nullable=True),
        sa.Column("modified", sa.Date(), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("title_type", sa.String(50), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("your_rating", sa.Integer(), nullable=True),
        sa.Column("date_rated", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("imdb_title_id"),
    )


def downgrade() -> None:
    op.drop_table("imdb_watchlist")

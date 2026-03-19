"""add actors, writer, plot, poster, metascore, awards, rated to title_metadata

Revision ID: 008
Revises: 007
Create Date: 2025-03-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, Sequence[str], None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("title_metadata", sa.Column("actors", sa.String(500), nullable=True))
    op.add_column("title_metadata", sa.Column("writer", sa.String(500), nullable=True))
    op.add_column("title_metadata", sa.Column("plot", sa.String(2000), nullable=True))
    op.add_column("title_metadata", sa.Column("poster", sa.String(500), nullable=True))
    op.add_column("title_metadata", sa.Column("metascore", sa.Integer(), nullable=True))
    op.add_column("title_metadata", sa.Column("awards", sa.String(500), nullable=True))
    op.add_column("title_metadata", sa.Column("rated", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("title_metadata", "actors")
    op.drop_column("title_metadata", "writer")
    op.drop_column("title_metadata", "plot")
    op.drop_column("title_metadata", "poster")
    op.drop_column("title_metadata", "metascore")
    op.drop_column("title_metadata", "awards")
    op.drop_column("title_metadata", "rated")

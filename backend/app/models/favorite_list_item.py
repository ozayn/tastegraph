"""Curated favorite list: titles you'd recommend to friends. Strong taste signal."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FavoriteListItem(Base):
    __tablename__ = "favorite_list"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    imdb_title_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

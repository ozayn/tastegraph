"""IMDb watchlist items from watchlist.csv export."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IMDbWatchlistItem(Base):
    __tablename__ = "imdb_watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    imdb_title_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created: Mapped[date | None] = mapped_column(Date, nullable=True)
    modified: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[str | None] = mapped_column(String(500), nullable=True)
    your_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_rated: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

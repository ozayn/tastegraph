from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IMDbRating(Base):
    __tablename__ = "imdb_ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    imdb_title_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_rated: Mapped[date | None] = mapped_column(Date, nullable=True)
    imdb_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    runtime_mins: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_votes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    directors: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

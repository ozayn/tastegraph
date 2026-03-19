"""Tracks OMDb enrichment failures to avoid retrying permanently failing titles."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MetadataEnrichmentFailure(Base):
    __tablename__ = "metadata_enrichment_failure"

    imdb_title_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    fail_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_failed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

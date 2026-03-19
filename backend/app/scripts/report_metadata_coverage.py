"""Report TitleMetadata coverage for key fields. Run from backend: python -m app.scripts.report_metadata_coverage."""

from sqlalchemy import and_, func

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata

_FIELDS = [
    "country",
    "languages",
    "poster",
    "actors",
    "writer",
    "plot",
    "metascore",
    "awards",
    "rated",
]
_STRING_FIELDS = {"country", "languages", "poster", "actors", "writer", "plot", "awards", "rated"}


def _has_value(col, field: str):
    """Non-null and non-empty. For strings, exclude '' and 'N/A'."""
    if field in _STRING_FIELDS:
        return and_(col.isnot(None), col != "", col != "N/A")
    return col.isnot(None)


def main() -> None:
    db = SessionLocal()
    try:
        total = db.query(TitleMetadata).count()
        print("=" * 50)
        print("TitleMetadata coverage report")
        print("=" * 50)
        print(f"\nTotal TitleMetadata rows: {total}")

        if total > 0:
            print("\n--- All TitleMetadata ---")
            for field in _FIELDS:
                col = getattr(TitleMetadata, field)
                n = db.query(func.count()).filter(_has_value(col, field)).scalar()
                pct = 100 * n / total if total else 0
                print(f"  {field:12} {n:5} / {total:5}  ({pct:5.1f}%)")

        # Ratings: titles that have both TitleMetadata and IMDbRating
        rating_total = (
            db.query(func.count())
            .select_from(TitleMetadata)
            .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
            .scalar()
            or 0
        )
        if rating_total > 0:
            print("\n--- In IMDbRating (rated titles with metadata) ---")
            for field in _FIELDS:
                col = getattr(TitleMetadata, field)
                n = (
                    db.query(func.count())
                    .select_from(TitleMetadata)
                    .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
                    .filter(_has_value(col, field))
                    .scalar()
                    or 0
                )
                pct = 100 * n / rating_total if rating_total else 0
                print(f"  {field:12} {n:5} / {rating_total:5}  ({pct:5.1f}%)")

        # Watchlist: titles that have both TitleMetadata and IMDbWatchlistItem
        watchlist_total = (
            db.query(func.count())
            .select_from(TitleMetadata)
            .join(IMDbWatchlistItem, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
            .scalar()
            or 0
        )
        if watchlist_total > 0:
            print("\n--- In IMDbWatchlistItem (watchlist titles with metadata) ---")
            for field in _FIELDS:
                col = getattr(TitleMetadata, field)
                n = (
                    db.query(func.count())
                    .select_from(TitleMetadata)
                    .join(IMDbWatchlistItem, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
                    .filter(_has_value(col, field))
                    .scalar()
                    or 0
                )
                pct = 100 * n / watchlist_total if watchlist_total else 0
                print(f"  {field:12} {n:5} / {watchlist_total:5}  ({pct:5.1f}%)")

        print("")
    finally:
        db.close()


if __name__ == "__main__":
    main()

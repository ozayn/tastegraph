# Watchlist schema plan

Based on IMDb watchlist export (`watchlist.csv`): ~1811 rows, columns include Position, Const, Created, Modified, Description, Title, Original Title, URL, Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors, Your Rating, Date Rated.

## Proposed IMDbWatchlistItem model

| Field | Type | Source | Required | Notes |
|-------|------|--------|----------|-------|
| `id` | int, PK | — | yes | Auto-increment |
| `imdb_title_id` | str(20) | Const | yes | Unique, indexed; links to TitleMetadata |
| `position` | int | Position | yes | Order in watchlist |
| `created` | date/datetime | Created | yes | When added to watchlist |
| `modified` | date/datetime | Modified | no | When list item was last changed |
| `title` | str(500) | Title | no | For display before metadata join |
| `title_type` | str(50) | Title Type | no | movie, series, episode |
| `year` | int | Year | no | For filtering without join |
| `your_rating` | int | Your Rating | no | If user already rated it |
| `date_rated` | date | Date Rated | no | When they rated it |
| `created_at` | datetime | — | yes | Server-side import timestamp |

## Store now (minimal)

- `imdb_title_id` (Const) — primary identifier
- `position` — preserve watchlist order
- `created` — when added
- `modified` — useful for sync/dedup

## Optional (store for quick display)

- `title`, `title_type`, `year` — show something before TitleMetadata enrichment
- `your_rating`, `date_rated` — if already rated, useful for “from watchlist” recommendations

## Defer (join or enrich later)

- Description, Original Title, URL, IMDb Rating, Runtime, Genres, Num Votes, Release Date, Directors — use TitleMetadata join or OMDb enrichment instead of duplicating

## Table name

`imdb_watchlist` — one row per watchlist item, keyed by `imdb_title_id` (unique) with `position` for ordering.

## Proposed SQLAlchemy model (for reference)

```python
class IMDbWatchlistItem(Base):
    __tablename__ = "imdb_watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    imdb_title_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created: Mapped[date | None] = mapped_column(Date, nullable=True)  # Created
    modified: Mapped[date | None] = mapped_column(Date, nullable=True)  # Modified
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    your_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_rated: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

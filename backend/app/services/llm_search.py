"""Grounded LLM-powered watchlist search. Retrieval first, LLM second.

Converts natural-language queries into structured intent, then retrieves and ranks
only from the actual watchlist. No invented titles.
"""

from dataclasses import dataclass, field

from openai import OpenAI
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import filter_variants_for_country, parse_and_normalize_countries
from app.services.favorite_boost import compute_favorite_boost, _load_favorites_by_role
from app.services.taste_signals import load_taste_signals, score_watchlist_item


@dataclass
class SearchIntent:
    """Structured search parameters extracted from natural language."""
    genres: list[str] = field(default_factory=list)
    countries: list[str] = field(default_factory=list)
    decade: str | None = None
    title_type: str | None = None
    similar_to: str | None = None
    emphasize_high_fit: bool = False
    mood_keywords: list[str] = field(default_factory=list)
    summary: str = ""


def _parse_query_with_llm(query: str) -> SearchIntent:
    """Use LLM to extract structured search intent. Returns empty intent if API unavailable."""
    if not settings.GROQ_API_KEY or not query or not query.strip():
        return SearchIntent()

    client = OpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )
    schema = """
{
  "genres": ["genre1", "genre2"],
  "countries": ["Country Name"],
  "decade": "2010s",
  "title_type": "movie",
  "similar_to": "Exact Title",
  "emphasize_high_fit": false,
  "mood_keywords": ["slow", "psychological"],
  "summary": "Brief description of interpreted intent"
}
Only include fields you can confidently infer. Use standard genre names (Drama, Comedy, Thriller, Sci-Fi, Romance, Documentary, etc.). Use full country names (United Kingdom, United States, France, Germany). For "similar to X" or "like X", set similar_to to the title. For "high fit", "for me", "my taste", set emphasize_high_fit true. Output valid JSON only, no markdown."""

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You extract structured search filters from natural-language movie/TV queries. The user has a watchlist. Output JSON only.",
                },
                {"role": "user", "content": f"Query: {query.strip()}\n\nSchema:\n{schema}"},
            ],
            temperature=0.1,
            max_tokens=400,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            return SearchIntent()

        import json
        # Strip markdown code block if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        data = json.loads(text)

        return SearchIntent(
            genres=[g for g in data.get("genres", []) if isinstance(g, str) and g.strip()],
            countries=[c for c in data.get("countries", []) if isinstance(c, str) and c.strip()],
            decade=data.get("decade") if isinstance(data.get("decade"), str) else None,
            title_type=data.get("title_type") if isinstance(data.get("title_type"), str) else None,
            similar_to=data.get("similar_to") if isinstance(data.get("similar_to"), str) else None,
            emphasize_high_fit=bool(data.get("emphasize_high_fit")),
            mood_keywords=[m for m in data.get("mood_keywords", []) if isinstance(m, str) and m.strip()],
            summary=(data.get("summary") or "").strip()[:200],
        )
    except Exception:
        return SearchIntent()


def _lookup_similar_title(db: Session, title_hint: str) -> dict | None:
    """Find a title in ratings or watchlist matching hint. Return genres, country, decade to use as signals."""
    if not title_hint or len(title_hint.strip()) < 2:
        return None
    hint = title_hint.strip().lower()
    hint_part = f"%{hint}%"

    # Prefer IMDbRating (user has seen it), then WatchlistItem
    for model, title_col in [(IMDbRating, IMDbRating.title), (IMDbWatchlistItem, IMDbWatchlistItem.title)]:
        q = db.query(model).filter(title_col.ilike(hint_part)).limit(1)
        if model == IMDbRating:
            q = q.filter(IMDbRating.user_rating.isnot(None))
        row = q.first()
        if row:
            imdb_id = row.imdb_title_id
            meta = db.query(TitleMetadata).filter(TitleMetadata.imdb_title_id == imdb_id).first()
            genres = (meta.genres if meta else getattr(row, "genres", None)) or ""
            country = meta.country if meta else None
            year = getattr(row, "year", None) or (meta.year if meta else None)
            decade = f"{year // 10 * 10}s" if year else None
            return {
                "genres": [g.strip() for g in genres.split(",") if g.strip()],
                "countries": list(parse_and_normalize_countries(country)) if country else [],
                "decade": decade,
            }
    return None


def search_watchlist(db: Session, query: str, limit: int = 15) -> dict:
    """Grounded search: parse query, retrieve from watchlist only, rank, explain.

    Returns { items, intent_summary, fallback }.
    fallback=True means LLM was unavailable or failed; we returned heuristic results.
    """
    intent = _parse_query_with_llm(query)
    fallback = not intent.summary and not intent.genres and not intent.countries

    # Enrich intent from "similar_to" if we find it in our data
    if intent.similar_to:
        similar = _lookup_similar_title(db, intent.similar_to)
        if similar:
            intent.genres = list(set(intent.genres) | set(similar.get("genres", [])))
            intent.countries = list(set(intent.countries) | set(similar.get("countries", [])))
            if not intent.decade and similar.get("decade"):
                intent.decade = similar["decade"]
        # If not found, we keep intent as-is; LLM may have extracted genre hints

    # Build base query: watchlist items, unrated, with metadata
    q = (
        db.query(
            IMDbWatchlistItem,
            TitleMetadata.poster,
            TitleMetadata.actors,
            TitleMetadata.directors,
            TitleMetadata.writer,
            TitleMetadata.country,
            TitleMetadata.genres,
        )
        .outerjoin(TitleMetadata, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbWatchlistItem.your_rating.is_(None))
    )
    rated_exists = exists(select(1).where(IMDbRating.imdb_title_id == IMDbWatchlistItem.imdb_title_id))
    q = q.filter(~rated_exists)

    # Apply filters from intent
    if intent.genres:
        genre_filters = []
        for g in intent.genres:
            if not g or not g.strip():
                continue
            pattern = f"%{g.strip()}%"
            genre_filters.append(
                or_(
                    IMDbWatchlistItem.genres.ilike(pattern),
                    TitleMetadata.genres.ilike(pattern),
                )
            )
        if genre_filters:
            q = q.filter(or_(*genre_filters))

    if intent.countries:
        country_filters = []
        for c in intent.countries:
            if not c or not c.strip():
                continue
            for v in filter_variants_for_country(c.strip()):
                country_filters.append(TitleMetadata.country.ilike(f"%{v}%"))
        if country_filters:
            q = q.filter(or_(*country_filters))

    if intent.decade:
        try:
            decade_num = int(intent.decade.replace("s", ""))
            y_from, y_to = decade_num, decade_num + 9
            q = q.filter(
                IMDbWatchlistItem.year.isnot(None),
                IMDbWatchlistItem.year >= y_from,
                IMDbWatchlistItem.year <= y_to,
            )
        except (ValueError, TypeError):
            pass

    if intent.title_type:
        tt = intent.title_type.lower()
        if tt == "movie":
            q = q.filter(IMDbWatchlistItem.title_type.ilike("movie"))
        elif tt in ("series", "tv", "show"):
            q = q.filter(IMDbWatchlistItem.title_type.ilike("%series%"))
        else:
            q = q.filter(IMDbWatchlistItem.title_type.ilike(f"%{tt}%"))

    signals = load_taste_signals(db)
    favorites_by_role = _load_favorites_by_role(db)
    favorite_list_ids = signals.get("favorite_list_ids", set())

    fetch_limit = min(200, limit * 5)
    rows = q.limit(fetch_limit).all()

    scored = []
    for r, poster, actors, directors, writer, country, meta_genres in rows:
        if r.imdb_title_id in favorite_list_ids:
            continue
        boost, matches = compute_favorite_boost(actors, directors, writer, favorites_by_role)
        genres_str = meta_genres or r.genres
        fit_score, explanation = score_watchlist_item(
            r.imdb_title_id, genres_str, country, r.year, directors, matches, signals
        )
        total_score = fit_score + boost * 2
        if intent.emphasize_high_fit:
            total_score = total_score * 2 + fit_score
        scored.append((total_score, r, poster, explanation))

    scored.sort(key=lambda x: -x[0])
    top = scored[:limit]

    # Build summary explanation
    parts = []
    if intent.summary:
        parts.append(intent.summary)
    else:
        if intent.genres:
            parts.append(f"genres: {', '.join(intent.genres[:3])}")
        if intent.countries:
            parts.append(f"countries: {', '.join(intent.countries[:3])}")
        if intent.decade:
            parts.append(f"decade: {intent.decade}")
        if intent.similar_to:
            parts.append(f"similar to: {intent.similar_to}")
        if intent.emphasize_high_fit:
            parts.append("emphasizing your taste fit")
    summary = "; ".join(parts) if parts else "Watchlist items matching your query"

    return {
        "items": [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "title_type": r.title_type,
                "year": r.year,
                "poster": poster if poster and poster != "N/A" else None,
                "explanation": {
                    "in_favorite_list": exp.get("in_favorite_list", False),
                    "matched_genres": exp.get("matched_genres", []),
                    "matched_countries": exp.get("matched_countries", []),
                    "matched_decade": exp.get("matched_decade"),
                    "matched_people": exp.get("matched_people", []),
                    "matched_strong_directors": exp.get("matched_strong_directors", []),
                    "top_reasons": exp.get("top_reasons", [])[:5],
                },
            }
            for _, r, poster, exp in top
        ],
        "intent_summary": summary,
        "fallback": fallback,
    }

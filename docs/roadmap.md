# TasteGraph Roadmap

## Phase 1 — MVP foundation

- Rich ratings import
- Watchlist import
- CSV-first data usage
- Basic recommendation surfaces
- Basic filters
- Clean modern frontend

## Phase 2 — Stronger metadata layer

- Prefer IMDbRating and IMDbWatchlistItem data first
- Use TitleMetadata as fallback/canonical enrichment
- Add extra metadata only when CSV does not already provide it
- Examples: languages now, other metadata later

## Phase 3 — True watchlist recommender

- Move from filtering to ranking
- Rank watchlist items based on taste history
- Use signals like genre overlap, title type preference, year/era preference
- Support "what should I watch first from my watchlist?"

## Phase 4 — Reference-title recommendations

- Support queries like "recommend movies like The Lobster to me"
- This needs similarity, not just filtering
- Likely tools: plot/summary/keyword enrichment, embeddings, similarity search

## Phase 5 — Natural-language recommender

- Let the user ask for recommendations conversationally
- Examples:
  - "recommend movies like The Lobster to me"
  - "from my watchlist"
  - "something romantic but strange"
  - "a Persian romance"
- Note: LLM interprets requests and explains results; it does not replace ranking logic

## Phase 6 — Platform-aware recommendation

- Support queries like "what should I watch on BritBox?"
- Note: requires platform availability data

## Phase 7 — Deployment and data sync

- Deploy frontend, backend, and database to Railway
- Make the deployed app usable with real data
- Add a safe sync workflow from local IMDb-derived data to the deployed database
- Support re-importing ratings/watchlist to the deployed environment without manual database edits
- Keep personal data sync explicit and controlled

---

## Recommended next order

1. Finish cleanup of current recommendation correctness
2. Build first watchlist ranking
3. Add reference-title recommendation
4. Add natural-language UI
5. Deploy to Railway
6. Add data sync/import flow for deployed app

---

## Product vision

TasteGraph should eventually answer questions like:

- What should I watch from my watchlist tonight?
- What in my watchlist best matches my taste?
- Recommend movies like The Lobster to me
- Show me Persian romance films I'm likely to love
- What should I watch on BritBox?

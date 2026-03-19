# How TasteGraph Works

A plain-language explanation of the app for future reference.

---

## 1. What TasteGraph is

TasteGraph is a personal movie and series recommender. It learns your taste from your IMDb ratings, watchlist, and curated lists, then recommends what to watch—especially from titles you’ve saved but haven’t seen yet. It also shows insights and studies about how your taste has changed over time.

---

## 2. The data it uses

**Ratings** — Titles you’ve rated on IMDb. This is the main signal of what you like. Your 8+ ratings are treated as strong preferences.

**Watchlist** — Titles you’ve saved to watch later. Used as the pool of candidates for watchlist-based recommendations.

**Favorite people** — A list you maintain of actors, directors, and writers you like. You can use a simple `name,role` CSV or an IMDb-style people export; the app infers roles from the export when needed.

**Favorite list** — A curated list of titles you’d recommend to friends. Treated as a strong taste signal: its genres, countries, and decades influence ranking. Its own titles are not shown as “underwatched” recommendations.

**Title metadata** — Extra info from OMDb (country, languages, directors, actors, poster, plot, etc.). Used for filtering, explanations, and ranking. Titles without metadata still work, but with less detail.

---

## 3. How metadata enrichment works

For titles in your ratings or watchlist that lack metadata (or have incomplete fields), the app fetches data from OMDb and stores it. Only missing or empty fields are updated.

Failures are recorded. Titles that failed in the last 7 days are skipped on the next run unless you explicitly retry. If OMDb returns a global auth or quota error, the run stops.

---

## 4. How homepage recommendations work

**Recommendations for you** — Shows titles you rated 8+, filtered by genre, country, title type, and year. Sorted by rating (highest first), then by date rated. Titles that feature your favorite people get a small boost. Each card explains why it was recommended (genres, country, decade, favorite people).

**From your watchlist** — Shows unrated watchlist titles that match your filters. Titles with favorite people are boosted. Sorted by that boost, then by position in your list.

---

## 5. How watchlist recommendations work

Same as “From your watchlist” on the homepage: you filter by genre, country, title type, and year. The app returns unrated watchlist items that match, with favorite-people matches highlighted. You can optionally include already-rated titles.

---

## 6. How underwatched high-fit watchlist works

This section surfaces unrated watchlist titles that best match your taste, so you know what to watch next.

**Excluded:** Titles you’ve already rated, and titles in your favorite list (they’re already curated).

**Signals used:**

- **Genres** — Top genres from your 8+ ratings and favorite list.
- **Countries** — Only countries where your 8+ rate is meaningfully above your overall rate (lift-based, not raw frequency).
- **Decades** — Release decades that appear often in your 8+ ratings.
- **Favorite people** — Directors, writers, actors from your list.
- **Strong directors** — Directors with at least 2 titles you rated 8+ (even if not in favorite people).
- **Favorite list** — Its genres, countries, and decades shape the signals, but its titles are not shown as candidates.

**Scoring:** Each match adds points (genres +2 each, countries +2 each, decade +1, favorite director +3, strong director +2, etc.). Titles are ranked by total score. Each card shows chips explaining why it fits.

---

## 7. What the Insights page shows

- **Overview** — Total rated, average rating, top genres by count, top genres by average rating, top countries, top release decades.
- **People** — Directors, actors, and writers you’ve seen most, with average rating.
- **Trends** — Ratings by year watched, average rating by year, release-year distribution.
- **Taste signals** — Genres, countries, and people that appear often in your 8+ ratings.

---

## 8. What the Studies page shows

- **Taste evolution over time** — How your ratings and preferences change by year.
- **Features associated with 8+ ratings** — Which genres, countries, decades, languages, and title types correlate with higher 8+ rates. Uses lift: how much more often you rate 8+ for that feature compared to your overall rate.
- **Watchlist taste alignment** — Genres and countries in your watchlist where you tend to rate 8+ when you do rate them.
- **Curated favorite list** — Count, overlap with rated titles, top genres and countries.
- **Favorite creators** — Directors, actors, and writers with at least 5 rated titles, ranked by average rating.
- **Genre combination analysis** — Genre pairs (e.g. Drama + Sci-Fi) that correlate with higher 8+ rates.

Support thresholds (e.g. minimum 15 rated titles) avoid one-off patterns from dominating.

---

## 9. How sync/local/remote workflows work

**Enrich locally** — Runs migrations, then fetches metadata from OMDb for titles in ratings or watchlist that are missing or incomplete. Writes to your local database.

**Sync remote** — Sends your local data to the deployed backend: ratings, watchlist, metadata (exported from local then uploaded), favorite people, and favorite list (if those files exist).

**Idempotent behavior** — Ratings and watchlist upsert. Favorite people and favorite list only insert missing and delete removed. Metadata only fills in missing fields. Running sync again with the same data does nothing.

---

## 10. Key design choices

**United States not auto-boosted** — Countries only count when your 8+ rate for that country is meaningfully above your overall rate (lift > 1.01). Being common alone (e.g. many US titles) does not make a country a positive signal.

**Favorite list titles excluded from underwatched high-fit** — Those titles are already curated; the section is for discovering what to watch next, not re-showing your own picks.

**Directors weighted above actors** — Directors are treated as stronger taste signals (e.g. +3 vs +1) because they shape the film more than individual actors.

**Support thresholds and top-10 limits** — Features need a minimum number of rated titles before they’re used. Many lists are capped at 10 to keep things readable and avoid noise.

---

## 11. Short summary

TasteGraph uses your IMDb ratings, watchlist, favorite people, and favorite list to learn your taste. It enriches titles with metadata, then recommends what to watch from your watchlist based on genres, countries, decades, and creators you tend to rate highly. It avoids boosting common-but-neutral patterns (like United States) and focuses on features that actually predict 8+ ratings. Insights and studies show how your taste evolves and which features matter most.

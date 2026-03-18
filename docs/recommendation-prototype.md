# First recommendation prototype

## Overview

End-to-end flow from IMDb ratings to filtered recommendations with metadata.

## Ratings import

- Raw IMDb ratings CSV (Title ID, Rating, Last Modified Date) → `imdb_ratings` table
- Scripts: `import_ratings_default`, POST `/ratings/import`

## Metadata enrichment (OMDb)

- OMDb API fetches title metadata by IMDb ID
- Upserts into `title_metadata` (title, year, genres, runtime, directors, etc.)
- Scripts: `fetch_one_metadata`, `enrich_one_title`, `enrich_missing_metadata`
- Requires `OMDB_API_KEY` in `backend/.env`

## Simple recommendations

- **Source:** Enriched titles (IMDbRating joined with TitleMetadata) rated 8 or higher
- **Endpoint:** `GET /recommendations/simple`
- **Explanation:** `GET /recommendations/simple-explanation` — deterministic plain-text from filters (no LLM)

## Frontend filters

| Filter      | Param           | Options                          |
|-------------|-----------------|----------------------------------|
| Genre       | `genre_contains`| Text (substring match)           |
| Title type  | `title_type`    | All, movie, series, episode      |
| Year from   | `year_from`     | Number                           |
| Year to     | `year_to`       | Number                           |

## Current limitations

- No watchlist yet
- No platform filter yet
- No mood or LLM reasoning yet

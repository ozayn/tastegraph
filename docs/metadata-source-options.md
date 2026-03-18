# Metadata source options for IMDb ID enrichment

## Option 1: OMDb API

| | |
|---|---|
| **Input** | IMDb ID (`i=tt1234567`) |
| **Metadata** | title, year, genre, runtime, director, imdb_rating, plot, poster |
| **Pros** | Direct IMDb ID support, simple REST API, one call per title |
| **Limitations** | Free tier: 1,000 requests/day; API key required |

## Option 2: TMDB API

| | |
|---|---|
| **Input** | IMDb ID via `/find/{external_id}?external_source=imdb_id` |
| **Metadata** | title, year, genres, runtime, release_date, vote_average; separate movie/tv responses |
| **Pros** | Free, no stated daily limit, comprehensive |
| **Limitations** | Response splits movie_results / tv_results; may need extra call for full details |

## Option 3: IMDb Datasets

| | |
|---|---|
| **Input** | Bulk: download `title.basics.tsv.gz`, filter by tconst (IMDb ID) |
| **Metadata** | titleType, primaryTitle, startYear, runtimeMinutes, genres |
| **Pros** | No API key, no rate limits, non-commercial use |
| **Limitations** | ~800MB download, TSV parse, periodic updates only |

---

## Recommendation

**OMDb API** for the first implementation: direct IMDb ID lookup, minimal integration, and the free tier is enough to test enrichment on a subset of ratings. Add throttling (e.g. 1 req/sec) to stay under 1,000/day. Revisit TMDB or IMDb datasets if rate limits or cost become an issue.

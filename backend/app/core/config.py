from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve backend root so .env loads correctly regardless of cwd
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"
# Exposed for scripts that need ``load_dotenv`` so ``os.environ`` matches ``backend/.env``.
ENV_FILE_PATH = _ENV_FILE


class Settings(BaseSettings):
    APP_NAME: str = "TasteGraph API"
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql://localhost:5432/tastegraph"
    OMDB_API_KEY: str = ""
    OMDB_API_KEY_FALLBACK: str = ""
    # Watchmode: BritBox catalog snapshot fetch (see app.scripts.fetch_britbox_catalog)
    WATCHMODE_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("WATCHMODE_API_KEY", "watchmode_api_key"),
    )
    # Optional: Watchmode /v1/sources `id` for BritBox (default: auto-pick Amazon Prime channel US)
    WATCHMODE_BRITBOX_SOURCE_ID: str = Field(
        default="",
        validation_alias=AliasChoices(
            "WATCHMODE_BRITBOX_SOURCE_ID",
            "watchmode_britbox_source_id",
        ),
    )
    # Optional: Watchmode /v1/sources `id` for MUBI US (default: resolve name "MUBI")
    WATCHMODE_MUBI_SOURCE_ID: str = Field(
        default="",
        validation_alias=AliasChoices(
            "WATCHMODE_MUBI_SOURCE_ID",
            "watchmode_mubi_source_id",
        ),
    )
    # TMDB (optional): poster fallback when OMDb URL is missing or unreachable
    TMDB_API_KEY: str = ""
    # CORS: comma-separated origins, e.g. "http://localhost:3000,http://127.0.0.1:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    PORT: int = 8000
    # Admin import: token required in X-Admin-Import-Token header for CSV upload endpoints
    ADMIN_IMPORT_TOKEN: str = ""
    # Optional: experimental public scrape URLs (refresh_imdb_public_scrape; not production path)
    IMDB_SCRAPE_LIST_URL: str = ""
    IMDB_SCRAPE_WATCHLIST_URL: str = ""
    IMDB_SCRAPE_RATINGS_URL: str = ""
    IMDB_SCRAPE_FAVORITE_PEOPLE_URL: str = ""
    # LLM search: Groq API key for grounded watchlist search (OpenAI-compatible)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def get_cors_origins() -> list[str]:
    """Parse CORS_ORIGINS into a list. Strips whitespace, ignores empty."""
    return [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

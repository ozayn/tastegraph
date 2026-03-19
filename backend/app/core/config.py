from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve backend root so .env loads correctly regardless of cwd
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    APP_NAME: str = "TasteGraph API"
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql://localhost:5432/tastegraph"
    OMDB_API_KEY: str = ""
    OMDB_API_KEY_FALLBACK: str = ""
    # CORS: comma-separated origins, e.g. "http://localhost:3000,https://myapp.railway.app"
    CORS_ORIGINS: str = "http://localhost:3000"
    PORT: int = 8000
    # Admin import: token required in X-Admin-Import-Token header for CSV upload endpoints
    ADMIN_IMPORT_TOKEN: str = ""

    class Config:
        env_file = _ENV_FILE


settings = Settings()


def get_cors_origins() -> list[str]:
    """Parse CORS_ORIGINS into a list. Strips whitespace, ignores empty."""
    return [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

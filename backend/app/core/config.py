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

    class Config:
        env_file = _ENV_FILE


settings = Settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "TasteGraph API"
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql://localhost:5432/tastegraph"

    class Config:
        env_file = ".env"


settings = Settings()

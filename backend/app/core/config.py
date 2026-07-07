from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Load application settings from environment variables."""
    # App
    PROJECT_NAME: str = "Meditation App API"
    API_V1_STR: str = "/api/v1"

    # CORS (React dev + prod later)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Database (used later for env override)
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/meditation"

    # AWS / S3
    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = ""

    # Optional Admin API Key
    ADMIN_API_KEY: str = "dev-secret"

    # Authentication
    JWT_SECRET_KEY: str = "development-only-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AUTH_COOKIE_NAME: str = "still_session"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        """Tell Pydantic where to read local environment values from."""
        env_file = ".env"
        case_sensitive = True


settings = Settings()

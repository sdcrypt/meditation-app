from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Load application settings from environment variables."""
    # App
    PROJECT_NAME: str = "Meditation App API"
    API_V1_STR: str = "/api/v1"
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    PASSWORD_RESET_URL_BASE: str = "http://localhost:5173/reset-password"

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
    AUTH_COOKIE_DOMAIN: str | None = None
    CSRF_COOKIE_NAME: str = "still_csrf"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    CSRF_TOKEN_EXPIRE_MINUTES: int = 120

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("AUTH_COOKIE_SAMESITE")
    @classmethod
    def validate_cookie_samesite(cls, value: str) -> str:
        """Keep cookie SameSite values within browser-supported options."""
        normalized = value.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
        return normalized

    @model_validator(mode="after")
    def validate_production_auth_settings(self):
        """Prevent unsafe cookie and URL settings in production."""
        if self.APP_ENV.lower() == "production":
            if not self.AUTH_COOKIE_SECURE:
                raise ValueError("AUTH_COOKIE_SECURE must be true in production")
            if not self.FRONTEND_URL.startswith("https://"):
                raise ValueError("FRONTEND_URL must use https in production")
            if not self.PASSWORD_RESET_URL_BASE.startswith("https://"):
                raise ValueError("PASSWORD_RESET_URL_BASE must use https in production")
            if self.JWT_SECRET_KEY == "development-only-change-me":
                raise ValueError("JWT_SECRET_KEY must be changed in production")
        return self

    class Config:
        """Tell Pydantic where to read local environment values from."""
        env_file = ".env"
        case_sensitive = True


settings = Settings()

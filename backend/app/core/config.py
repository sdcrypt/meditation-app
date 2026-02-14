from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
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
    ADMIN_API_KEY: str = "85da5853a21895bce88893b1fddf03d1a49b449b3271e4bc6b1338e068baa627"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

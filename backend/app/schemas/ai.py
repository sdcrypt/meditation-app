from pydantic import BaseModel, Field, field_validator

from app.schemas.meditation import MeditationRead


class AIRecommendationRequest(BaseModel):
    """User intent used to recommend existing meditations."""

    query: str = Field(min_length=3, max_length=500)
    device_id: int | None = Field(default=None, ge=0)
    limit: int = Field(default=3, ge=1, le=5)

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        return " ".join(value.strip().split())


class AIRecommendedMeditation(BaseModel):
    """One recommendation returned to the Explore UI."""

    meditation: MeditationRead
    reason: str = Field(max_length=180)


class AIRecommendationResponse(BaseModel):
    """A ranked set of meditations, AI-backed or deterministic fallback."""

    items: list[AIRecommendedMeditation]
    fallback: bool = False
    message: str = ""

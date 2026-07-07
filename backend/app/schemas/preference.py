from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_GOALS = {
    "stress",
    "sleep",
    "focus",
    "healing",
    "spiritual",
    "mindfulness",
}
ALLOWED_DURATIONS = {"short", "medium", "long", "any", ""}
ALLOWED_EXPERIENCE_LEVELS = {"beginner", "intermediate", "advanced", "all levels", ""}
ALLOWED_PRACTICE_TIMES = {"morning", "afternoon", "evening", "bedtime", ""}


class UserPreferenceBase(BaseModel):
    """Recommendation preferences chosen during onboarding."""
    goals: list[str] = Field(default_factory=list, max_length=20)
    preferred_duration: str = Field(default="", max_length=30)
    experience_level: str = Field(default="", max_length=50)
    preferred_practice_time: str = Field(default="", max_length=50)

    @field_validator("goals", mode="before")
    @classmethod
    def validate_goals(cls, value: list[str] | None) -> list[str]:
        """Clean selected goals and keep only supported choices."""
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("goals must be a list")

        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                raise ValueError("goals must contain only strings")
            goal = item.strip().lower()
            if not goal:
                continue
            if goal not in ALLOWED_GOALS:
                raise ValueError(f"unsupported goal: {goal}")
            if goal not in seen:
                seen.add(goal)
                cleaned.append(goal)
        return cleaned

    @field_validator("preferred_duration")
    @classmethod
    def validate_duration(cls, value: str) -> str:
        """Accept only the supported duration preference values."""
        value = value.strip().lower()
        if value not in ALLOWED_DURATIONS:
            raise ValueError("unsupported duration preference")
        return value

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, value: str) -> str:
        """Accept only the supported experience level values."""
        value = value.strip().lower()
        if value not in ALLOWED_EXPERIENCE_LEVELS:
            raise ValueError("unsupported experience level")
        return value

    @field_validator("preferred_practice_time")
    @classmethod
    def validate_practice_time(cls, value: str) -> str:
        """Accept only the supported practice time values."""
        value = value.strip().lower()
        if value not in ALLOWED_PRACTICE_TIMES:
            raise ValueError("unsupported practice time")
        return value


class UserPreferenceUpdate(UserPreferenceBase):
    """Preferences sent when a user saves onboarding choices."""
    pass


class UserPreferenceRead(UserPreferenceBase):
    """Saved recommendation preferences returned to the frontend."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

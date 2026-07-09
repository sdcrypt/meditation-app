from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.meditation import MeditationRead


class ProgramBase(BaseModel):
    """Shared fields used to create, edit, and show a program."""
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    artwork_url: str | None = None
    level: str = Field(default="beginner", min_length=1, max_length=50)
    goal: str = Field(default="", max_length=80)
    is_published: bool = True

    @field_validator("artwork_url", mode="before")
    @classmethod
    def normalize_artwork_url(cls, value: str | None) -> str | None:
        """Treat empty artwork URLs as missing artwork."""
        if value is None:
            return None
        value = value.strip()
        return value or None


class ProgramCreate(ProgramBase):
    """Fields accepted when an administrator creates a program."""
    meditation_ids: list[int] = Field(default_factory=list)


class ProgramUpdate(BaseModel):
    """Fields accepted when an administrator edits a program."""
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    artwork_url: str | None = None
    level: str | None = Field(default=None, min_length=1, max_length=50)
    goal: str | None = Field(default=None, max_length=80)
    is_published: bool | None = None
    meditation_ids: list[int] | None = None

    @field_validator("artwork_url", mode="before")
    @classmethod
    def normalize_artwork_url(cls, value: str | None) -> str | None:
        """Treat empty artwork URLs as missing artwork."""
        if value is None:
            return None
        value = value.strip()
        return value or None


class ProgramMeditationRead(BaseModel):
    """One meditation in its program order."""
    position: int
    is_completed: bool = False
    meditation: MeditationRead


class ProgramRead(ProgramBase):
    """Program details returned by public and admin APIs."""
    id: int
    created_at: datetime
    updated_at: datetime
    is_enrolled: bool = False
    completed_meditations: int = 0
    total_meditations: int = 0
    completion_percent: int = 0
    meditations: list[ProgramMeditationRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserProgramRead(BaseModel):
    """A program enrollment saved for a signed-in user."""
    id: int
    user_id: int
    program_id: int
    started_at: datetime
    completed_at: datetime | None
    program: ProgramRead

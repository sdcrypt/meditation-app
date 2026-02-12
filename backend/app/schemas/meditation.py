from pydantic import BaseModel
from typing import Optional


class MeditationBase(BaseModel):
    title: str
    category: str
    duration_sec: int
    level: str
    audio_url: Optional[str] = None


class MeditationCreate(MeditationBase):
    pass


class MeditationRead(MeditationBase):
    id: int
    is_published: bool

    model_config = {"from_attributes": True}

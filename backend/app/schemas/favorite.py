from datetime import datetime

from pydantic import BaseModel

from app.schemas.meditation import MeditationRead


class FavoriteRead(BaseModel):
    """A saved meditation with the date it was saved."""
    id: int
    meditation_id: int
    created_at: datetime
    meditation: MeditationRead


class FavoriteListResponse(BaseModel):
    """All meditations saved by the signed-in user."""
    items: list[FavoriteRead]
    meditation_ids: list[int]

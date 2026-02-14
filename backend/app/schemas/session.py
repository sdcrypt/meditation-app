from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionStart(BaseModel):
    meditation_id: int
    device_id: int


class SessionComplete(BaseModel):
    seconds_listened: int


class SessionRead(BaseModel):
    id: int
    meditation_id: int
    started_at: datetime
    completed_at: Optional[datetime]
    seconds_listened: int

    model_config = {"from_attributes": True}

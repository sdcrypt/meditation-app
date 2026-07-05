from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionStart(BaseModel):
    meditation_id: int = Field(gt=0)
    device_id: int = Field(gt=0)


class SessionProgress(BaseModel):
    device_id: int = Field(gt=0)
    position_sec: int = Field(ge=0)
    seconds_listened: int = Field(ge=0)


class SessionComplete(SessionProgress):
    pass


class SessionRead(BaseModel):
    id: int
    meditation_id: int
    device_id: int
    started_at: datetime
    completed_at: datetime | None
    last_listened_at: datetime | None
    seconds_listened: int
    last_position_sec: int

    model_config = ConfigDict(from_attributes=True)


class DailyActivity(BaseModel):
    date: date
    day_label: str
    mindful_seconds: int
    mindful_minutes: int
    qualifies_for_streak: bool


class ProgressSummary(BaseModel):
    mindful_seconds: int
    mindful_minutes: int
    total_sessions: int
    completed_sessions: int
    current_streak: int
    longest_streak: int
    today_seconds: int
    today_minutes: int
    last_7_days: list[DailyActivity]


class SessionHistoryItem(BaseModel):
    id: int
    meditation_id: int
    title: str
    category: str
    teacher_name: str
    artwork_url: str | None
    meditation_duration_sec: int
    seconds_listened: int
    last_position_sec: int
    progress_percent: int
    started_at: datetime
    last_activity_at: datetime
    completed_at: datetime | None
    is_completed: bool


class SessionHistoryResponse(BaseModel):
    items: list[SessionHistoryItem]
    total: int
    limit: int
    offset: int

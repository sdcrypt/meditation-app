from datetime import datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_REMINDER_FREQUENCIES = {"daily", "weekdays", "weekends"}


class UserReminderPreferenceBase(BaseModel):
    """Reminder settings a user can save from the Account page."""
    is_enabled: bool = False
    reminder_time: time = Field(default=time(hour=8, minute=0))
    frequency: str = "daily"
    timezone: str = "UTC"

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str) -> str:
        """Allow only the supported reminder repeat choices."""
        normalized = value.strip().lower()
        if normalized not in ALLOWED_REMINDER_FREQUENCIES:
            raise ValueError("unsupported reminder frequency")
        return normalized

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        """Ensure the reminder timezone is a known IANA timezone."""
        normalized = value.strip() or "UTC"
        try:
            ZoneInfo(normalized)
        except ZoneInfoNotFoundError:
            raise ValueError("unsupported timezone")
        return normalized


class UserReminderPreferenceUpdate(UserReminderPreferenceBase):
    """Reminder settings sent when a user saves changes."""
    pass


class UserReminderPreferenceRead(UserReminderPreferenceBase):
    """Saved reminder settings returned to the frontend."""
    id: int
    user_id: int
    last_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReminderSendResult(BaseModel):
    """Summary returned after due reminder emails are processed."""
    checked: int
    sent: int
    skipped: int
    errors: list[str] = Field(default_factory=list)

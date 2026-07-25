from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Time, text
from sqlalchemy.sql import func

from app.db.base import Base


class UserReminderPreference(Base):
    """Email reminder settings saved by a signed-in user."""
    __tablename__ = "user_reminder_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    is_enabled = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    reminder_time = Column(Time(timezone=False), nullable=False)
    frequency = Column(String, nullable=False, default="daily", server_default="daily")
    timezone = Column(String, nullable=False, default="UTC", server_default="UTC")
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, text
from sqlalchemy.sql import func

from app.db.base import Base


class UserPreference(Base):
    """Personalization choices saved for a signed-in user."""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    goals = Column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'::json"),
    )
    preferred_duration = Column(String, nullable=False, default="", server_default="")
    experience_level = Column(String, nullable=False, default="", server_default="")
    preferred_practice_time = Column(String, nullable=False, default="", server_default="")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

from sqlalchemy import Column, DateTime, ForeignKey, Integer, text
from sqlalchemy.sql import func
from app.db.base import Base


class MeditationSession(Base):
    """One listening attempt for a meditation on a specific device."""
    __tablename__ = "meditation_sessions"

    id = Column(Integer, primary_key=True)
    meditation_id = Column(Integer, ForeignKey("meditations.id"))
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    device_id = Column(Integer)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_listened_at = Column(DateTime(timezone=True), nullable=True)
    seconds_listened = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    last_position_sec = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )


class MeditationSessionActivity(Base):
    """A small record of listening time used to build daily progress."""
    __tablename__ = "meditation_session_activity"

    id = Column(Integer, primary_key=True)
    session_id = Column(
        Integer,
        ForeignKey("meditation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seconds_listened = Column(Integer, nullable=False)
    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

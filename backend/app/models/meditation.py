from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text, text
from sqlalchemy.sql import func

from app.db.base import Base


class Meditation(Base):
    __tablename__ = "meditations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    duration_sec = Column(Integer, nullable=False)
    level = Column(String, nullable=False)
    audio_url = Column(String, nullable=True)
    description = Column(Text, nullable=False, default="", server_default="")
    teacher_name = Column(String, nullable=False, default="", server_default="")
    artwork_url = Column(String, nullable=True)
    tags = Column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'::json"),
    )
    benefits = Column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'::json"),
    )
    is_featured = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    is_published = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

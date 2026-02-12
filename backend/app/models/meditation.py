from sqlalchemy import Column, Integer, String, Boolean
from app.db.base import Base


class Meditation(Base):
    __tablename__ = "meditations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    duration_sec = Column(Integer, nullable=False)
    level = Column(String, nullable=False)
    audio_url = Column(String, nullable=True)
    is_published = Column(Boolean, default=True)

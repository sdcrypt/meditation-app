from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class UserFavorite(Base):
    """A meditation saved by a signed-in user."""
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "meditation_id", name="uq_user_favorite"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    meditation_id = Column(
        Integer,
        ForeignKey("meditations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

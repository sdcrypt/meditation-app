from sqlalchemy import Boolean, Column, DateTime, Integer, String, text
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    """A person who can sign in as a normal user or administrator."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    @property
    def is_email_verified(self) -> bool:
        """Tell whether the user has confirmed ownership of their email."""
        return self.email_verified_at is not None

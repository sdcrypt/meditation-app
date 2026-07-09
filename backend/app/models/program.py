from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.sql import func

from app.db.base import Base


class Program(Base):
    """A guided collection of meditations shown as a program."""
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False, default="", server_default="")
    artwork_url = Column(String, nullable=True)
    level = Column(String, nullable=False, default="beginner", server_default="beginner")
    goal = Column(String, nullable=False, default="", server_default="")
    is_published = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProgramMeditation(Base):
    """One meditation placed at a specific position inside a program."""
    __tablename__ = "program_meditations"
    __table_args__ = (
        UniqueConstraint("program_id", "meditation_id", name="uq_program_meditation"),
        UniqueConstraint("program_id", "position", name="uq_program_position"),
    )

    id = Column(Integer, primary_key=True)
    program_id = Column(
        Integer,
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    meditation_id = Column(
        Integer,
        ForeignKey("meditations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False)


class UserProgram(Base):
    """A program started by a signed-in user."""
    __tablename__ = "user_programs"
    __table_args__ = (
        UniqueConstraint("user_id", "program_id", name="uq_user_program"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    program_id = Column(
        Integer,
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

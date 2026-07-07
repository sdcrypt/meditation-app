from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.meditation import Meditation



def init_db():
    """Add a small demo meditation library when the database is empty."""
    db: Session = SessionLocal()
    try:
        # Seed only if empty. Schema creation belongs exclusively to Alembic.
        if db.query(Meditation).count() == 0:
            demo_data = [
                Meditation(
                    title="5 min Calm Reset",
                    category="stress",
                    duration_sec=300,
                    level="beginner",
                    audio_url="https://example.com/calm.mp3",
                    is_published=True,
                ),
                Meditation(
                    title="10 min Deep Focus",
                    category="focus",
                    duration_sec=600,
                    level="beginner",
                    audio_url="https://example.com/focus.mp3",
                    is_published=True,
                ),
            ]

            db.add_all(demo_data)
            db.commit()
    finally:
        db.close()

from sqlalchemy.orm import Session

from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.models.meditation import Meditation
from app.models.session import MeditationSession



def init_db():
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    # Seed only if empty
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

    db.close()

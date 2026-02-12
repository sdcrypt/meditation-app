from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.schemas.meditation import MeditationCreate, MeditationRead

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MeditationRead)
def create_meditation(
    payload: MeditationCreate,
    db: Session = Depends(get_db),
):
    meditation = Meditation(
        title=payload.title,
        category=payload.category,
        duration_sec=payload.duration_sec,
        level=payload.level,
        audio_url=payload.audio_url,
        is_published=True,
    )

    db.add(meditation)
    db.commit()
    db.refresh(meditation)

    return meditation

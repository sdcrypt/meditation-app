from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.schemas.meditation import MeditationRead

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[MeditationRead])
def list_meditations(db: Session = Depends(get_db)):
    return db.query(Meditation).filter(Meditation.is_published == True).all()


@router.get("/{meditation_id}", response_model=MeditationRead)
def get_meditation(meditation_id: int, db: Session = Depends(get_db)):
    return db.query(Meditation).filter(
        Meditation.id == meditation_id,
        Meditation.is_published == True
    ).first()

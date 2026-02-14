from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import date

from app.db.session import SessionLocal
from app.models.session import MeditationSession
from app.schemas.session import SessionStart, SessionComplete

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/start")
def start_session(payload: SessionStart, db: Session = Depends(get_db)):
    session = MeditationSession(
        meditation_id=payload.meditation_id,
        device_id=payload.device_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/complete")
def complete_session(
    session_id: int,
    payload: SessionComplete,
    db: Session = Depends(get_db),
):
    session = db.query(MeditationSession).filter(
        MeditationSession.id == session_id
    ).first()

    session.seconds_listened = payload.seconds_listened
    session.completed_at = func.now()

    db.commit()
    return session


@router.get("/stats/{device_id}")
def stats(device_id: int, db: Session = Depends(get_db)):
    total_seconds = db.query(func.sum(MeditationSession.seconds_listened)).filter(
        MeditationSession.device_id == device_id
    ).scalar() or 0

    today = date.today()

    streak = db.query(MeditationSession).filter(
        MeditationSession.device_id == device_id,
        MeditationSession.completed_at >= today
    ).count()

    return {
        "total_minutes": round(total_seconds / 60),
        "streak": streak,
    }

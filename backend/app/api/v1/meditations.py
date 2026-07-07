from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.schemas.meditation import MeditationRead

router = APIRouter()


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[MeditationRead])
def list_meditations(
    category: str | None = Query(default=None, min_length=1, max_length=80),
    featured: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Return published meditations for the Explore page."""
    query = db.query(Meditation).filter(Meditation.is_published.is_(True))

    if category:
        query = query.filter(Meditation.category.ilike(category.strip()))
    if featured is not None:
        query = query.filter(Meditation.is_featured.is_(featured))

    return (
        query.order_by(
            Meditation.is_featured.desc(),
            Meditation.created_at.desc(),
            Meditation.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{meditation_id}", response_model=MeditationRead)
def get_meditation(meditation_id: int, db: Session = Depends(get_db)):
    """Return one published meditation by its id."""
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id,
        Meditation.is_published.is_(True),
    ).first()

    if meditation is None:
        raise HTTPException(status_code=404, detail="Meditation not found")
    return meditation

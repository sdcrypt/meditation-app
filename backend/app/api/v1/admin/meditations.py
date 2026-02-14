from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.admin_auth import verify_admin_key

from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.schemas.meditation import MeditationCreate, MeditationRead
from app.services.s3_service import S3Service


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MeditationRead, dependencies=[Depends(verify_admin_key)])
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


@router.post(
    "/{meditation_id}/upload-audio",
    response_model=MeditationRead,
    dependencies=[Depends(verify_admin_key)],
)
def upload_audio(
    meditation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id
    ).first()

    if not meditation:
        raise HTTPException(status_code=404, detail="Meditation not found")

    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")

    s3 = S3Service()
    public_url = s3.upload_file(
        file.file,
        file.filename,
        file.content_type,
    )

    meditation.audio_url = public_url
    db.commit()
    db.refresh(meditation)

    return meditation

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.admin_auth import verify_admin_key
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.models.session import MeditationSession
from app.schemas.meditation import MeditationCreate, MeditationRead, MeditationUpdate
from app.services.s3_service import S3Service
from app.core.dependencies import require_admin


logger = get_logger(__name__)
router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=MeditationRead, dependencies=[Depends(require_admin)])
def create_meditation(
    payload: MeditationCreate,
    db: Session = Depends(get_db),
):
    logger.info("Creating meditation: title=%s, category=%s", payload.title, payload.category)
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
    logger.info("Meditation created successfully: id=%s, title=%s", meditation.id, meditation.title)
    return meditation


@router.post(
    "/{meditation_id}/upload-audio",
    response_model=MeditationRead,
    dependencies=[Depends(require_admin)],
)
def upload_audio(
    meditation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    logger.info("Uploading audio for meditation_id=%s, filename=%s", meditation_id, file.filename)
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id
    ).first()

    if not meditation:
        logger.warning("Meditation not found for upload: meditation_id=%s", meditation_id)
        raise HTTPException(status_code=404, detail="Meditation not found")

    if not file.content_type.startswith("audio/"):
        logger.warning("Invalid file type for upload: content_type=%s, meditation_id=%s", file.content_type, meditation_id)
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
    logger.info("Audio uploaded successfully for meditation_id=%s", meditation_id)
    return meditation

@router.patch(
    "/{meditation_id}",
    response_model=MeditationRead,
    dependencies=[Depends(require_admin)],
)
def update_meditation(
    meditation_id: int,
    payload: MeditationUpdate,
    db: Session = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True)
    logger.info("Updating meditation_id=%s, fields=%s", meditation_id, list(update_data.keys()))
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id
    ).first()

    if not meditation:
        logger.warning("Meditation not found for update: meditation_id=%s", meditation_id)
        raise HTTPException(status_code=404, detail="Meditation not found")

    for field, value in update_data.items():
        setattr(meditation, field, value)

    db.commit()
    db.refresh(meditation)
    logger.info("Meditation updated successfully: meditation_id=%s", meditation_id)
    return meditation


@router.delete("/{meditation_id}", dependencies=[Depends(require_admin)])
def delete_meditation(
    meditation_id: int,
    db: Session = Depends(get_db),
):
    logger.info("Deleting meditation_id: %s", meditation_id)
    meditation = db.query(Meditation).filter(Meditation.id == meditation_id).first()
    if not meditation:
        raise HTTPException(status_code=404, detail="Meditation not found")
    # Delete related meditation_sessions first to avoid FK violation
    db.query(MeditationSession).filter(MeditationSession.meditation_id == meditation_id).delete()
    db.delete(meditation)
    db.commit()
    logger.info("Meditation deleted successfully: %s", meditation_id)
    return {"message": "Meditation deleted successfully"}
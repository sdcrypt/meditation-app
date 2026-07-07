from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.models.session import MeditationSession
from app.schemas.meditation import MeditationCreate, MeditationRead, MeditationUpdate
from app.services.s3_service import S3Service


logger = get_logger(__name__)
router = APIRouter()
ALLOWED_ARTWORK_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_ARTWORK_BYTES = 10 * 1024 * 1024


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get(
    "/",
    response_model=list[MeditationRead],
    dependencies=[Depends(require_admin)],
)
def list_all_meditations(db: Session = Depends(get_db)):
    """Return every meditation so an administrator can manage the library."""
    return db.query(Meditation).order_by(
        Meditation.created_at.desc(),
        Meditation.id.desc(),
    ).all()


@router.post("/", response_model=MeditationRead, dependencies=[Depends(require_admin)])
def create_meditation(
    payload: MeditationCreate,
    db: Session = Depends(get_db),
):
    """Create a new meditation record from the admin form."""
    logger.info("Creating meditation: title=%s, category=%s", payload.title, payload.category)
    meditation = Meditation(**payload.model_dump())

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
    """Upload an audio file and attach its public URL to a meditation."""
    logger.info("Uploading audio for meditation_id=%s, filename=%s", meditation_id, file.filename)
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id
    ).first()

    if not meditation:
        logger.warning("Meditation not found for upload: meditation_id=%s", meditation_id)
        raise HTTPException(status_code=404, detail="Meditation not found")

    if not file.content_type or not file.content_type.startswith("audio/"):
        logger.warning("Invalid file type for upload: content_type=%s, meditation_id=%s", file.content_type, meditation_id)
        raise HTTPException(status_code=400, detail="File must be audio")

    s3 = S3Service()
    public_url = s3.upload_file(
        file.file,
        file.filename or "meditation-audio",
        file.content_type,
        prefix="audio",
    )

    meditation.audio_url = public_url
    db.commit()
    db.refresh(meditation)
    logger.info("Audio uploaded successfully for meditation_id=%s", meditation_id)
    return meditation


@router.post(
    "/{meditation_id}/upload-artwork",
    response_model=MeditationRead,
    dependencies=[Depends(require_admin)],
)
def upload_artwork(
    meditation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload artwork for a meditation after checking the image type and size."""
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id
    ).first()
    if not meditation:
        raise HTTPException(status_code=404, detail="Meditation not found")

    if file.content_type not in ALLOWED_ARTWORK_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Artwork must be a JPEG, PNG, WebP, or AVIF image",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_ARTWORK_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Artwork must be 10 MB or smaller",
        )

    s3 = S3Service()
    meditation.artwork_url = s3.upload_file(
        file.file,
        file.filename or "meditation-artwork",
        file.content_type,
        prefix="artwork",
    )
    db.commit()
    db.refresh(meditation)
    logger.info(
        "Artwork uploaded successfully for meditation_id=%s",
        meditation_id,
    )
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
    """Update the editable fields for one meditation."""
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
    """Delete a meditation and its related listening sessions."""
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

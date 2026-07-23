import csv
from io import BytesIO, StringIO, TextIOWrapper
import mimetypes
from pathlib import PurePath
import zipfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
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
PLACEHOLDER_LIST_VALUES = {"[]", "{}", "null", "none", "undefined", "-", "n/a", "na"}
ALLOWED_ARTWORK_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_ARTWORK_BYTES = 10 * 1024 * 1024
CSV_COLUMNS = {
    "title",
    "category",
    "duration_sec",
    "level",
    "description",
    "teacher_name",
    "tags",
    "benefits",
    "is_featured",
    "is_published",
    "audio_filename",
    "artwork_filename",
}


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


def join_list(values: list[str] | None, separator: str) -> str:
    """Join list values into a single CSV cell."""
    if not values:
        return ""
    return separator.join(str(item).strip() for item in values if str(item).strip())


@router.get("/export.csv", dependencies=[Depends(require_admin)])
def export_meditations_csv(db: Session = Depends(get_db)):
    """Download all meditations as a CSV backup for production content."""
    output = StringIO()
    fieldnames = [
        "id",
        "title",
        "category",
        "duration_sec",
        "level",
        "description",
        "teacher_name",
        "tags",
        "benefits",
        "is_featured",
        "is_published",
        "audio_url",
        "artwork_url",
        "created_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for meditation in db.query(Meditation).order_by(Meditation.id.asc()).all():
        writer.writerow(
            {
                "id": meditation.id,
                "title": meditation.title,
                "category": meditation.category,
                "duration_sec": meditation.duration_sec,
                "level": meditation.level,
                "description": meditation.description,
                "teacher_name": meditation.teacher_name,
                "tags": join_list(meditation.tags, ","),
                "benefits": join_list(meditation.benefits, "|"),
                "is_featured": meditation.is_featured,
                "is_published": meditation.is_published,
                "audio_url": meditation.audio_url or "",
                "artwork_url": meditation.artwork_url or "",
                "created_at": meditation.created_at.isoformat() if meditation.created_at else "",
            }
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="meditations-backup.csv"'},
    )


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


def parse_bool(value: str | None, default: bool) -> bool:
    """Read common yes/no values from CSV text."""
    if value is None or value.strip() == "":
        return default
    normalized = value.strip().lower()
    if normalized in {"true", "yes", "y", "1"}:
        return True
    if normalized in {"false", "no", "n", "0"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def split_csv_list(value: str | None, separator: str) -> list[str]:
    """Split a simple CSV cell into a clean list."""
    if not value:
        return []
    items = []
    for item in value.split(separator):
        cleaned = item.strip()
        if cleaned and cleaned.casefold() not in PLACEHOLDER_LIST_VALUES:
            items.append(cleaned)
    return items


def normalize_zip_name(filename: str | None) -> str:
    """Normalize a media filename so it can be matched safely in a ZIP."""
    if not filename:
        return ""
    return str(PurePath(filename.replace("\\", "/")))


def read_media_zip(media_zip: UploadFile | None) -> tuple[dict[str, bytes], list[str]]:
    """Read safe audio and artwork files from an optional ZIP upload."""
    if media_zip is None:
        return {}, []

    warnings = []
    files: dict[str, bytes] = {}
    try:
        archive = zipfile.ZipFile(BytesIO(media_zip.file.read()))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="media_zip must be a valid ZIP file")

    for info in archive.infolist():
        raw_name = info.filename.replace("\\", "/")
        normalized_name = normalize_zip_name(raw_name)
        if info.is_dir() or normalized_name.startswith("../") or "/../" in normalized_name:
            continue
        if not (
            normalized_name.startswith("audio/")
            or normalized_name.startswith("artwork/")
        ):
            warnings.append(f"Ignored ZIP file outside audio/ or artwork/: {raw_name}")
            continue
        files[normalized_name] = archive.read(info)
    return files, warnings


def find_media_file(files: dict[str, bytes], folder: str, filename: str | None) -> tuple[str, bytes] | None:
    """Find a media file by its folder and CSV filename."""
    safe_name = PurePath((filename or "").replace("\\", "/")).name
    if not safe_name:
        return None
    key = f"{folder}/{safe_name}"
    if key in files:
        return key, files[key]
    normalized = normalize_zip_name(filename)
    if normalized in files and normalized.startswith(f"{folder}/"):
        return normalized, files[normalized]
    return None


def build_meditation_payload(row: dict[str, str | None]) -> MeditationCreate:
    """Convert one CSV row into validated meditation data."""
    return MeditationCreate(
        title=(row.get("title") or "").strip(),
        category=(row.get("category") or "").strip(),
        duration_sec=int((row.get("duration_sec") or "").strip()),
        level=(row.get("level") or "").strip(),
        audio_url=None,
        description=(row.get("description") or "").strip(),
        teacher_name=(row.get("teacher_name") or "").strip(),
        artwork_url=None,
        tags=split_csv_list(row.get("tags"), ","),
        benefits=split_csv_list(row.get("benefits"), "|"),
        is_featured=parse_bool(row.get("is_featured"), False),
        is_published=parse_bool(row.get("is_published"), True),
    )


@router.post(
    "/bulk-import",
    dependencies=[Depends(require_admin)],
)
def bulk_import_meditations(
    csv_file: UploadFile = File(...),
    media_zip: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    """Create or update meditations from a CSV file and optional media ZIP."""
    filename = (csv_file.filename or "").lower()
    if not filename.endswith(".csv") and csv_file.content_type not in {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "text/plain",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="csv_file must be a CSV file")

    media_files, warnings = read_media_zip(media_zip)
    reader = csv.DictReader(TextIOWrapper(csv_file.file, encoding="utf-8-sig"))
    missing_columns = {"title", "category", "duration_sec", "level"} - set(reader.fieldnames or [])
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing_columns))}",
        )

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    s3 = S3Service()

    for row_number, row in enumerate(reader, start=2):
        try:
            payload = build_meditation_payload(row)
        except (ValueError, ValidationError) as error:
            skipped += 1
            errors.append(f"Row {row_number}: {error}")
            continue

        meditation = db.query(Meditation).filter(
            Meditation.title == payload.title
        ).first()
        is_new = meditation is None
        if meditation is None:
            meditation = Meditation()
            db.add(meditation)

        for field, value in payload.model_dump().items():
            if field in {"audio_url", "artwork_url"} and value is None:
                continue
            setattr(meditation, field, value)

        audio_filename = row.get("audio_filename")
        audio_file = find_media_file(media_files, "audio", audio_filename)
        if audio_filename and audio_file is None:
            warnings.append(f"Row {row_number}: audio file not found: {audio_filename}")
        elif audio_file is not None:
            audio_key, audio_bytes = audio_file
            content_type = mimetypes.guess_type(audio_key)[0] or "application/octet-stream"
            if not content_type.startswith("audio/"):
                warnings.append(f"Row {row_number}: skipped non-audio file: {audio_filename}")
            else:
                meditation.audio_url = s3.upload_file(
                    BytesIO(audio_bytes),
                    PurePath(audio_key).name,
                    content_type,
                    prefix="audio",
                )

        artwork_filename = row.get("artwork_filename")
        artwork_file = find_media_file(media_files, "artwork", artwork_filename)
        if artwork_filename and artwork_file is None:
            warnings.append(f"Row {row_number}: artwork file not found: {artwork_filename}")
        elif artwork_file is not None:
            artwork_key, artwork_bytes = artwork_file
            content_type = mimetypes.guess_type(artwork_key)[0] or "application/octet-stream"
            if content_type not in ALLOWED_ARTWORK_TYPES:
                warnings.append(f"Row {row_number}: skipped unsupported artwork type: {artwork_filename}")
            elif len(artwork_bytes) > MAX_ARTWORK_BYTES:
                warnings.append(f"Row {row_number}: skipped artwork over 10 MB: {artwork_filename}")
            else:
                meditation.artwork_url = s3.upload_file(
                    BytesIO(artwork_bytes),
                    PurePath(artwork_key).name,
                    content_type,
                    prefix="artwork/meditations",
                )

        if is_new:
            created += 1
        else:
            updated += 1

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "warnings": warnings,
        "errors": errors,
        "expected_columns": sorted(CSV_COLUMNS),
    }


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
        prefix="artwork/meditations",
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

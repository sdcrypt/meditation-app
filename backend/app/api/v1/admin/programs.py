import csv
from io import BytesIO, StringIO, TextIOWrapper
import mimetypes
from pathlib import PurePath
import zipfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.api.v1.program_utils import program_to_read, replace_program_meditations
from app.core.dependencies import require_admin
from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.models.program import Program, ProgramMeditation
from app.schemas.program import ProgramCreate, ProgramRead, ProgramUpdate
from app.services.s3_service import S3Service

router = APIRouter()
ALLOWED_ARTWORK_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_ARTWORK_BYTES = 10 * 1024 * 1024
PROGRAM_CSV_COLUMNS = {
    "title",
    "description",
    "goal",
    "level",
    "is_published",
    "artwork_url",
    "artwork_filename",
    "meditation_ids",
    "meditation_titles",
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
    response_model=list[ProgramRead],
    dependencies=[Depends(require_admin)],
)
def list_all_programs(db: Session = Depends(get_db)):
    """Return every program so an administrator can manage them."""
    programs = db.query(Program).order_by(
        Program.created_at.desc(),
        Program.id.desc(),
    ).all()
    return [program_to_read(db, program) for program in programs]


@router.get("/export.csv", dependencies=[Depends(require_admin)])
def export_programs_csv(db: Session = Depends(get_db)):
    """Download all programs and ordered meditation details as a CSV backup."""
    output = StringIO()
    fieldnames = [
        "id",
        "title",
        "description",
        "goal",
        "level",
        "is_published",
        "artwork_url",
        "meditation_ids",
        "meditation_titles",
        "created_at",
        "updated_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    programs = db.query(Program).order_by(Program.id.asc()).all()
    for program in programs:
        rows = db.query(ProgramMeditation, Meditation).join(
            Meditation,
            Meditation.id == ProgramMeditation.meditation_id,
        ).filter(
            ProgramMeditation.program_id == program.id,
        ).order_by(ProgramMeditation.position.asc()).all()
        writer.writerow(
            {
                "id": program.id,
                "title": program.title,
                "description": program.description,
                "goal": program.goal,
                "level": program.level,
                "is_published": program.is_published,
                "artwork_url": program.artwork_url or "",
                "meditation_ids": "|".join(str(meditation.id) for _, meditation in rows),
                "meditation_titles": "|".join(meditation.title for _, meditation in rows),
                "created_at": program.created_at.isoformat() if program.created_at else "",
                "updated_at": program.updated_at.isoformat() if program.updated_at else "",
            }
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="programs-backup.csv"'},
    )


@router.post("/", response_model=ProgramRead, dependencies=[Depends(require_admin)])
def create_program(payload: ProgramCreate, db: Session = Depends(get_db)):
    """Create a program and save its ordered meditations."""
    program = Program(
        title=payload.title,
        description=payload.description,
        artwork_url=payload.artwork_url,
        level=payload.level,
        goal=payload.goal,
        is_published=payload.is_published,
    )
    db.add(program)
    db.flush()
    replace_program_meditations(db, program, payload.meditation_ids)
    db.commit()
    db.refresh(program)
    return program_to_read(db, program)


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


def split_ordered_cell(value: str | None) -> list[str]:
    """Split a pipe-separated CSV cell while preserving order."""
    if not value:
        return []
    return [item.strip() for item in value.split("|") if item.strip()]


def normalize_zip_name(filename: str | None) -> str:
    """Normalize an artwork filename so it can be matched safely in a ZIP."""
    if not filename:
        return ""
    return str(PurePath(filename.replace("\\", "/")))


def read_artwork_zip(artwork_zip: UploadFile | None) -> tuple[dict[str, bytes], list[str]]:
    """Read safe artwork files from an optional ZIP upload."""
    if artwork_zip is None:
        return {}, []

    warnings = []
    files: dict[str, bytes] = {}
    try:
        archive = zipfile.ZipFile(BytesIO(artwork_zip.file.read()))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="artwork_zip must be a valid ZIP file")

    for info in archive.infolist():
        raw_name = info.filename.replace("\\", "/")
        normalized_name = normalize_zip_name(raw_name)
        if info.is_dir() or normalized_name.startswith("../") or "/../" in normalized_name:
            continue
        if not normalized_name.startswith("artwork/"):
            warnings.append(f"Ignored ZIP file outside artwork/: {raw_name}")
            continue
        files[normalized_name] = archive.read(info)
    return files, warnings


def find_artwork_file(files: dict[str, bytes], filename: str | None) -> tuple[str, bytes] | None:
    """Find program artwork by filename in the artwork folder."""
    safe_name = PurePath((filename or "").replace("\\", "/")).name
    if not safe_name:
        return None
    key = f"artwork/{safe_name}"
    if key in files:
        return key, files[key]
    normalized = normalize_zip_name(filename)
    if normalized in files and normalized.startswith("artwork/"):
        return normalized, files[normalized]
    return None


def ordered_meditation_ids_from_row(
    db: Session,
    row: dict[str, str | None],
) -> tuple[list[int], list[str]]:
    """Resolve ordered meditation IDs from IDs and exact titles in a CSV row."""
    errors = []
    ordered_ids: list[int] = []
    seen_ids: set[int] = set()

    raw_ids = split_ordered_cell(row.get("meditation_ids"))
    if raw_ids:
        for raw_id in raw_ids:
            try:
                meditation_id = int(raw_id)
            except ValueError:
                errors.append(f"invalid meditation ID: {raw_id}")
                continue
            meditation = db.query(Meditation).filter(
                Meditation.id == meditation_id,
                Meditation.is_published.is_(True),
            ).first()
            if meditation is None:
                errors.append(f"published meditation ID not found: {meditation_id}")
                continue
            if meditation_id not in seen_ids:
                ordered_ids.append(meditation_id)
                seen_ids.add(meditation_id)
        return ordered_ids, errors

    raw_titles = split_ordered_cell(row.get("meditation_titles"))
    for title in raw_titles:
        meditation = db.query(Meditation).filter(
            Meditation.title == title,
            Meditation.is_published.is_(True),
        ).first()
        if meditation is None:
            errors.append(f"published meditation title not found: {title}")
            continue
        if meditation.id not in seen_ids:
            ordered_ids.append(meditation.id)
            seen_ids.add(meditation.id)
    return ordered_ids, errors


@router.post(
    "/bulk-import",
    dependencies=[Depends(require_admin)],
)
def bulk_import_programs(
    csv_file: UploadFile = File(...),
    artwork_zip: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    """Create or update programs from CSV and optional artwork ZIP."""
    filename = (csv_file.filename or "").lower()
    if not filename.endswith(".csv") and csv_file.content_type not in {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "text/plain",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="csv_file must be a CSV file")

    artwork_files, warnings = read_artwork_zip(artwork_zip)
    reader = csv.DictReader(TextIOWrapper(csv_file.file, encoding="utf-8-sig"))
    missing_columns = {"title", "level"} - set(reader.fieldnames or [])
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
        title = (row.get("title") or "").strip()
        level = (row.get("level") or "").strip()
        if not title or not level:
            skipped += 1
            errors.append(f"Row {row_number}: title and level are required")
            continue

        meditation_ids, meditation_errors = ordered_meditation_ids_from_row(db, row)
        if meditation_errors:
            skipped += 1
            errors.append(f"Row {row_number}: {'; '.join(meditation_errors)}")
            continue
        if not meditation_ids:
            skipped += 1
            errors.append(
                f"Row {row_number}: provide meditation_ids or meditation_titles"
            )
            continue

        try:
            is_published = parse_bool(row.get("is_published"), True)
        except ValueError as error:
            skipped += 1
            errors.append(f"Row {row_number}: {error}")
            continue

        program = db.query(Program).filter(Program.title == title).first()
        is_new = program is None
        if program is None:
            program = Program(title=title)
            db.add(program)
            db.flush()

        program.title = title
        program.description = (row.get("description") or "").strip()
        program.goal = (row.get("goal") or "").strip()
        program.level = level
        program.is_published = is_published
        program.artwork_url = (row.get("artwork_url") or "").strip() or program.artwork_url

        artwork_filename = row.get("artwork_filename")
        artwork_file = find_artwork_file(artwork_files, artwork_filename)
        if row.get("artwork_url"):
            pass
        elif artwork_filename and artwork_file is None:
            warnings.append(f"Row {row_number}: artwork file not found: {artwork_filename}")
        elif artwork_file is not None:
            artwork_key, artwork_bytes = artwork_file
            content_type = mimetypes.guess_type(artwork_key)[0] or "application/octet-stream"
            if content_type not in ALLOWED_ARTWORK_TYPES:
                warnings.append(f"Row {row_number}: skipped unsupported artwork type: {artwork_filename}")
            elif len(artwork_bytes) > MAX_ARTWORK_BYTES:
                warnings.append(f"Row {row_number}: skipped artwork over 10 MB: {artwork_filename}")
            else:
                program.artwork_url = s3.upload_file(
                    BytesIO(artwork_bytes),
                    PurePath(artwork_key).name,
                    content_type,
                    prefix="artwork/programs",
                )

        program.updated_at = func.now()
        replace_program_meditations(db, program, meditation_ids)
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
        "expected_columns": sorted(PROGRAM_CSV_COLUMNS),
    }


@router.patch(
    "/{program_id}",
    response_model=ProgramRead,
    dependencies=[Depends(require_admin)],
)
def update_program(
    program_id: int,
    payload: ProgramUpdate,
    db: Session = Depends(get_db),
):
    """Update a program and optionally replace its meditation order."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    update_data = payload.model_dump(exclude_unset=True)
    meditation_ids = update_data.pop("meditation_ids", None)
    for field, value in update_data.items():
        setattr(program, field, value)
    program.updated_at = func.now()
    if meditation_ids is not None:
        replace_program_meditations(db, program, meditation_ids)

    db.commit()
    db.refresh(program)
    return program_to_read(db, program)


@router.post(
    "/{program_id}/upload-artwork",
    response_model=ProgramRead,
    dependencies=[Depends(require_admin)],
)
def upload_program_artwork(
    program_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload artwork for a program and save its public URL."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

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
    program.artwork_url = s3.upload_file(
        file.file,
        file.filename or "program-artwork",
        file.content_type,
        prefix="artwork/programs",
    )
    program.updated_at = func.now()
    db.commit()
    db.refresh(program)
    return program_to_read(db, program)


@router.delete("/{program_id}", dependencies=[Depends(require_admin)])
def delete_program(program_id: int, db: Session = Depends(get_db)):
    """Delete a program and its ordered meditation list."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    db.query(ProgramMeditation).filter(
        ProgramMeditation.program_id == program_id
    ).delete(synchronize_session=False)
    db.delete(program)
    db.commit()
    return {"message": "Program deleted successfully"}

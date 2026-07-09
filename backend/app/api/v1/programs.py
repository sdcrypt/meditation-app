from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.program_utils import program_to_read
from app.db.session import SessionLocal
from app.models.program import Program
from app.schemas.program import ProgramRead

router = APIRouter()


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[ProgramRead])
def list_programs(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Return published programs for public browsing."""
    programs = db.query(Program).filter(
        Program.is_published.is_(True),
    ).order_by(
        Program.created_at.desc(),
        Program.id.desc(),
    ).offset(offset).limit(limit).all()
    return [program_to_read(db, program) for program in programs]


@router.get("/{program_id}", response_model=ProgramRead)
def get_program(program_id: int, db: Session = Depends(get_db)):
    """Return one published program with its ordered meditations."""
    program = db.query(Program).filter(
        Program.id == program_id,
        Program.is_published.is_(True),
    ).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program_to_read(db, program)

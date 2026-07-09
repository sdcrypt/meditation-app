from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.api.v1.program_utils import program_to_read, replace_program_meditations
from app.core.dependencies import require_admin
from app.db.session import SessionLocal
from app.models.program import Program, ProgramMeditation
from app.schemas.program import ProgramCreate, ProgramRead, ProgramUpdate

router = APIRouter()


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

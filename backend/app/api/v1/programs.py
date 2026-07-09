from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.program_utils import program_to_read
from app.core.dependencies import get_current_user, get_optional_user
from app.db.session import SessionLocal
from app.models.program import Program, UserProgram
from app.models.user import User
from app.schemas.program import ProgramRead, UserProgramRead

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
    current_user: User | None = Depends(get_optional_user),
):
    """Return published programs for public browsing."""
    programs = db.query(Program).filter(
        Program.is_published.is_(True),
    ).order_by(
        Program.created_at.desc(),
        Program.id.desc(),
    ).offset(offset).limit(limit).all()
    enrolled_ids = set()
    if current_user is not None and programs:
        enrolled_ids = {
            item[0]
            for item in db.query(UserProgram.program_id).filter(
                UserProgram.user_id == current_user.id,
                UserProgram.program_id.in_([program.id for program in programs]),
            ).all()
        }
    return [
        program_to_read(
            db,
            program,
            current_user=current_user,
            is_enrolled=program.id in enrolled_ids,
        )
        for program in programs
    ]


@router.get("/{program_id}", response_model=ProgramRead)
def get_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Return one published program with its ordered meditations."""
    program = db.query(Program).filter(
        Program.id == program_id,
        Program.is_published.is_(True),
    ).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    is_enrolled = False
    if current_user is not None:
        is_enrolled = db.query(UserProgram.id).filter(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program.id,
        ).first() is not None
    return program_to_read(
        db,
        program,
        current_user=current_user,
        is_enrolled=is_enrolled,
    )


@router.get("/me/enrollments", response_model=list[UserProgramRead])
def list_my_programs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return programs started by the signed-in user."""
    rows = db.query(UserProgram, Program).join(
        Program,
        Program.id == UserProgram.program_id,
    ).filter(
        UserProgram.user_id == current_user.id,
        Program.is_published.is_(True),
    ).order_by(UserProgram.started_at.desc()).all()
    return [
        UserProgramRead(
            id=enrollment.id,
            user_id=enrollment.user_id,
            program_id=enrollment.program_id,
            started_at=enrollment.started_at,
            completed_at=enrollment.completed_at,
            program=program_to_read(
                db,
                program,
                current_user=current_user,
                is_enrolled=True,
            ),
        )
        for enrollment, program in rows
    ]


@router.post("/{program_id}/start", response_model=UserProgramRead)
def start_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a program for the signed-in user."""
    program = db.query(Program).filter(
        Program.id == program_id,
        Program.is_published.is_(True),
    ).first()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    enrollment = db.query(UserProgram).filter(
        UserProgram.user_id == current_user.id,
        UserProgram.program_id == program_id,
    ).first()
    if enrollment is None:
        enrollment = UserProgram(
            user_id=current_user.id,
            program_id=program_id,
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

    return UserProgramRead(
        id=enrollment.id,
        user_id=enrollment.user_id,
        program_id=enrollment.program_id,
        started_at=enrollment.started_at,
        completed_at=enrollment.completed_at,
        program=program_to_read(
            db,
            program,
            current_user=current_user,
            is_enrolled=True,
        ),
    )

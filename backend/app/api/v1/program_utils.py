from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.meditation import Meditation
from app.models.program import Program, ProgramMeditation, UserProgram
from app.models.session import MeditationSession
from app.models.user import User
from app.schemas.program import (
    ProgramMeditationRead,
    ProgramNextMeditationRead,
    ProgramRead,
)


def update_enrollment_completion(
    enrollment: UserProgram,
    completed_meditations: int,
    total_meditations: int,
) -> None:
    """Keep a user's program completion date in sync with their progress."""
    is_complete = total_meditations > 0 and completed_meditations == total_meditations
    if is_complete and enrollment.completed_at is None:
        enrollment.completed_at = datetime.now(UTC)
    elif not is_complete and enrollment.completed_at is not None:
        enrollment.completed_at = None


def program_to_read(
    db: Session,
    program: Program,
    *,
    current_user: User | None = None,
    enrollment: UserProgram | None = None,
) -> ProgramRead:
    """Build a program response with meditations in the saved order."""
    rows = db.query(ProgramMeditation, Meditation).join(
        Meditation,
        Meditation.id == ProgramMeditation.meditation_id,
    ).filter(
        ProgramMeditation.program_id == program.id,
        Meditation.is_published.is_(True),
    ).order_by(ProgramMeditation.position.asc()).all()
    meditation_ids = [meditation.id for _, meditation in rows]
    started_ids = set()
    completed_ids = set()
    is_enrolled = enrollment is not None
    if current_user is not None and is_enrolled and meditation_ids:
        started_ids = {
            item[0]
            for item in db.query(MeditationSession.meditation_id).filter(
                MeditationSession.user_id == current_user.id,
                MeditationSession.program_id == program.id,
                MeditationSession.meditation_id.in_(meditation_ids),
            ).distinct().all()
        }
        completed_ids = {
            item[0]
            for item in db.query(MeditationSession.meditation_id).filter(
                MeditationSession.user_id == current_user.id,
                MeditationSession.program_id == program.id,
                MeditationSession.meditation_id.in_(meditation_ids),
                MeditationSession.completed_at.isnot(None),
            ).distinct().all()
        }
        recent_incomplete_session = db.query(MeditationSession).filter(
            MeditationSession.user_id == current_user.id,
            MeditationSession.program_id == program.id,
            MeditationSession.meditation_id.in_(meditation_ids),
            MeditationSession.completed_at.is_(None),
        ).order_by(
            MeditationSession.last_listened_at.desc().nullslast(),
            MeditationSession.started_at.desc(),
            MeditationSession.id.desc(),
        ).first()
        recent_incomplete_meditation_id = (
            recent_incomplete_session.meditation_id
            if recent_incomplete_session is not None
            else None
        )
    else:
        recent_incomplete_meditation_id = None
    total_meditations = len(meditation_ids)
    completed_meditations = len(completed_ids)
    if enrollment is not None:
        update_enrollment_completion(
            enrollment,
            completed_meditations,
            total_meditations,
        )
        db.flush()
    completion_percent = (
        round((completed_meditations / total_meditations) * 100)
        if total_meditations
        else 0
    )
    next_meditation = None
    if is_enrolled and completed_meditations < total_meditations:
        if recent_incomplete_meditation_id is not None:
            for item, meditation in rows:
                if meditation.id == recent_incomplete_meditation_id:
                    next_meditation = ProgramNextMeditationRead(
                        id=meditation.id,
                        title=meditation.title,
                        position=item.position,
                    )
                    break
        for item, meditation in rows:
            if next_meditation is not None:
                break
            if meditation.id not in completed_ids:
                next_meditation = ProgramNextMeditationRead(
                    id=meditation.id,
                    title=meditation.title,
                    position=item.position,
                )
                break

    return ProgramRead(
        id=program.id,
        title=program.title,
        description=program.description,
        artwork_url=program.artwork_url,
        level=program.level,
        goal=program.goal,
        is_published=program.is_published,
        created_at=program.created_at,
        updated_at=program.updated_at,
        is_enrolled=is_enrolled,
        completed_meditations=completed_meditations,
        total_meditations=total_meditations,
        completion_percent=completion_percent,
        next_meditation=next_meditation,
        meditations=[
            ProgramMeditationRead(
                position=item.position,
                is_started=meditation.id in started_ids,
                is_completed=meditation.id in completed_ids,
                meditation=meditation,
            )
            for item, meditation in rows
        ],
    )


def sync_user_programs_for_meditation(
    db: Session,
    user: User,
    meditation_id: int,
    program_id: int | None = None,
) -> None:
    """Update enrolled programs that contain a just-completed meditation."""
    if program_id is None:
        return
    rows = db.query(UserProgram, Program).join(
        Program,
        Program.id == UserProgram.program_id,
    ).join(
        ProgramMeditation,
        ProgramMeditation.program_id == Program.id,
    ).filter(
        UserProgram.user_id == user.id,
        UserProgram.program_id == program_id,
        Program.is_published.is_(True),
        ProgramMeditation.meditation_id == meditation_id,
    ).all()
    for enrollment, program in rows:
        program_to_read(
            db,
            program,
            current_user=user,
            enrollment=enrollment,
        )


def replace_program_meditations(
    db: Session,
    program: Program,
    meditation_ids: list[int],
) -> None:
    """Replace a program's ordered meditation list."""
    unique_ids = []
    seen = set()
    for meditation_id in meditation_ids:
        if meditation_id not in seen:
            seen.add(meditation_id)
            unique_ids.append(meditation_id)

    existing_ids = {
        item[0]
        for item in db.query(Meditation.id).filter(
            Meditation.id.in_(unique_ids),
            Meditation.is_published.is_(True),
        ).all()
    }
    ordered_ids = [
        meditation_id
        for meditation_id in unique_ids
        if meditation_id in existing_ids
    ]

    db.query(ProgramMeditation).filter(
        ProgramMeditation.program_id == program.id
    ).delete(synchronize_session=False)
    for position, meditation_id in enumerate(ordered_ids, start=1):
        db.add(
            ProgramMeditation(
                program_id=program.id,
                meditation_id=meditation_id,
                position=position,
            )
        )

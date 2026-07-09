from sqlalchemy.orm import Session

from app.models.meditation import Meditation
from app.models.program import Program, ProgramMeditation
from app.models.session import MeditationSession
from app.models.user import User
from app.schemas.program import ProgramMeditationRead, ProgramRead


def program_to_read(
    db: Session,
    program: Program,
    *,
    current_user: User | None = None,
    is_enrolled: bool = False,
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
    completed_ids = set()
    if current_user is not None and is_enrolled and meditation_ids:
        completed_ids = {
            item[0]
            for item in db.query(MeditationSession.meditation_id).filter(
                MeditationSession.user_id == current_user.id,
                MeditationSession.meditation_id.in_(meditation_ids),
                MeditationSession.completed_at.isnot(None),
            ).distinct().all()
        }
    total_meditations = len(meditation_ids)
    completed_meditations = len(completed_ids)
    completion_percent = (
        round((completed_meditations / total_meditations) * 100)
        if total_meditations
        else 0
    )

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
        meditations=[
            ProgramMeditationRead(
                position=item.position,
                is_completed=meditation.id in completed_ids,
                meditation=meditation,
            )
            for item, meditation in rows
        ],
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

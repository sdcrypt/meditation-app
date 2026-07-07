from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.dependencies import get_current_user
from app.db.session import SessionLocal
from app.models.preference import UserPreference
from app.models.user import User
from app.schemas.preference import UserPreferenceRead, UserPreferenceUpdate

router = APIRouter()


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/me", response_model=UserPreferenceRead | None)
def get_my_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return saved recommendation preferences for the signed-in user."""
    return db.query(UserPreference).filter(
        UserPreference.user_id == current_user.id
    ).first()


@router.put("/me", response_model=UserPreferenceRead)
def update_my_preferences(
    payload: UserPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update recommendation preferences for the signed-in user."""
    preference = db.query(UserPreference).filter(
        UserPreference.user_id == current_user.id
    ).first()

    if preference is None:
        preference = UserPreference(user_id=current_user.id)
        db.add(preference)

    preference.goals = payload.goals
    preference.preferred_duration = payload.preferred_duration
    preference.experience_level = payload.experience_level
    preference.preferred_practice_time = payload.preferred_practice_time
    preference.updated_at = func.now()

    db.commit()
    db.refresh(preference)
    return preference

from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.db.session import SessionLocal
from app.models.reminder import UserReminderPreference
from app.models.user import User
from app.schemas.reminder import (
    ReminderSendResult,
    UserReminderPreferenceRead,
    UserReminderPreferenceUpdate,
)
from app.services.email_service import send_practice_reminder_email


router = APIRouter()


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def default_reminder_for_user(user: User) -> UserReminderPreference:
    """Build default reminder settings without saving them yet."""
    return UserReminderPreference(
        id=0,
        user_id=user.id,
        is_enabled=False,
        reminder_time=time(hour=8, minute=0),
        frequency="daily",
        timezone="UTC",
        last_sent_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@router.get("/me", response_model=UserReminderPreferenceRead)
def get_my_reminder_preference(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return saved email reminder settings for the signed-in user."""
    preference = db.query(UserReminderPreference).filter(
        UserReminderPreference.user_id == current_user.id
    ).first()
    return preference or default_reminder_for_user(current_user)


@router.put("/me", response_model=UserReminderPreferenceRead)
def update_my_reminder_preference(
    payload: UserReminderPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update email reminder settings for the signed-in user."""
    preference = db.query(UserReminderPreference).filter(
        UserReminderPreference.user_id == current_user.id
    ).first()

    if preference is None:
        preference = UserReminderPreference(user_id=current_user.id)
        db.add(preference)

    preference.is_enabled = payload.is_enabled
    preference.reminder_time = payload.reminder_time
    preference.frequency = payload.frequency
    preference.timezone = payload.timezone
    preference.updated_at = func.now()

    db.commit()
    db.refresh(preference)
    return preference


def frequency_matches(frequency: str, local_now: datetime) -> bool:
    """Return whether a reminder frequency applies today."""
    weekday = local_now.weekday()
    if frequency == "daily":
        return True
    if frequency == "weekdays":
        return weekday < 5
    if frequency == "weekends":
        return weekday >= 5
    return False


def was_sent_today(preference: UserReminderPreference, local_now: datetime) -> bool:
    """Check whether this reminder has already been sent today."""
    if preference.last_sent_at is None:
        return False
    sent_local = preference.last_sent_at.astimezone(ZoneInfo(preference.timezone))
    return sent_local.date() == local_now.date()


def reminder_is_due(preference: UserReminderPreference, now_utc: datetime) -> bool:
    """Decide whether a reminder should be sent at the current time."""
    local_now = now_utc.astimezone(ZoneInfo(preference.timezone))
    if not frequency_matches(preference.frequency, local_now):
        return False
    if was_sent_today(preference, local_now):
        return False
    return local_now.time().replace(second=0, microsecond=0) >= preference.reminder_time


@router.post(
    "/admin/send-due",
    response_model=ReminderSendResult,
    dependencies=[Depends(require_admin)],
)
def send_due_reminders(db: Session = Depends(get_db)):
    """Send due email reminders to verified users who opted in."""
    now_utc = datetime.now(UTC)
    checked = 0
    sent = 0
    skipped = 0
    errors: list[str] = []
    practice_url = f"{settings.FRONTEND_URL.rstrip('/')}/explore"

    preferences = db.query(UserReminderPreference, User).join(
        User,
        User.id == UserReminderPreference.user_id,
    ).filter(
        UserReminderPreference.is_enabled.is_(True),
        User.is_active.is_(True),
        User.email_verified_at.isnot(None),
    ).all()

    for preference, user in preferences:
        checked += 1
        try:
            if not reminder_is_due(preference, now_utc):
                skipped += 1
                continue
            email_sent = send_practice_reminder_email(user.email, practice_url)
            if email_sent:
                preference.last_sent_at = now_utc
                preference.updated_at = func.now()
                sent += 1
            else:
                skipped += 1
        except Exception as error:
            skipped += 1
            errors.append(f"{user.email}: {error}")

    db.commit()
    return ReminderSendResult(
        checked=checked,
        sent=sent,
        skipped=skipped,
        errors=errors,
    )

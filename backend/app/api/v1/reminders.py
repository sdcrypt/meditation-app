import base64
import html
import hmac
from datetime import UTC, datetime, time
from hashlib import sha256
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
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


def create_unsubscribe_token(user_id: int, email: str) -> str:
    """Create a signed token that can disable reminders without login."""
    payload = f"{user_id}:{email.lower()}".encode("utf-8")
    encoded_payload = base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")
    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        sha256,
    ).hexdigest()
    return f"{encoded_payload}.{signature}"


def parse_unsubscribe_token(token: str) -> tuple[int, str]:
    """Validate an unsubscribe token and return its user id and email."""
    if "." not in token:
        raise ValueError("invalid token")
    encoded_payload, signature = token.rsplit(".", 1)
    expected_signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("invalid token")
    padded_payload = encoded_payload + "=" * (-len(encoded_payload) % 4)
    try:
        raw_payload = base64.urlsafe_b64decode(padded_payload.encode("utf-8")).decode("utf-8")
        user_id_text, email = raw_payload.split(":", 1)
        return int(user_id_text), email.lower()
    except (ValueError, UnicodeDecodeError) as error:
        raise ValueError("invalid token") from error


def reminder_urls_for_user(user: User) -> tuple[str, str]:
    """Build practice and unsubscribe URLs used in reminder emails."""
    practice_url = f"{settings.FRONTEND_URL.rstrip('/')}/explore"
    token = create_unsubscribe_token(user.id, user.email)
    unsubscribe_url = (
        f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{settings.API_V1_STR}/reminders/unsubscribe"
        f"?token={token}"
    )
    return practice_url, unsubscribe_url


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


@router.post("/me/send-test")
def send_test_reminder(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send one immediate reminder email to the signed-in user."""
    if current_user.email_verified_at is None:
        raise HTTPException(
            status_code=400,
            detail="Verify your email before sending a test reminder.",
        )
    practice_url, unsubscribe_url = reminder_urls_for_user(current_user)
    email_sent = send_practice_reminder_email(
        current_user.email,
        practice_url,
        unsubscribe_url,
    )
    if not email_sent:
        raise HTTPException(
            status_code=503,
            detail="Reminder email could not be sent. Check email provider settings.",
        )
    return {"message": "Test reminder sent."}


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe_from_reminders(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Disable reminders from a signed email link."""
    try:
        user_id, email = parse_unsubscribe_token(token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")

    user = db.query(User).filter(
        User.id == user_id,
        func.lower(User.email) == email,
    ).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    preference = db.query(UserReminderPreference).filter(
        UserReminderPreference.user_id == user.id
    ).first()
    if preference is not None:
        preference.is_enabled = False
        preference.updated_at = func.now()
        db.commit()

    account_url = f"{settings.FRONTEND_URL.rstrip('/')}/account"
    safe_email = html.escape(user.email)
    return f"""
    <html>
      <head>
        <title>Still reminders turned off</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;background:#f8f6ef;color:#173f3a;font-family:Arial,sans-serif">
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px">
          <section style="max-width:560px;padding:36px;border:1px solid #dfe3da;border-radius:24px;background:#fffdf8;box-shadow:0 22px 70px rgba(27,66,58,.12)">
            <p style="margin:0 0 10px;color:#bd7058;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Still reminders</p>
            <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:42px;font-weight:500;line-height:1.05">Reminder emails are off.</h1>
            <p style="margin:0 0 24px;color:#6d7b75;line-height:1.7">You will no longer receive Still practice reminder emails for {safe_email}.</p>
            <a href="{account_url}" style="display:inline-flex;align-items:center;min-height:42px;padding:0 18px;border-radius:999px;color:white;background:#23584e;text-decoration:none;font-size:13px;font-weight:700">Open account settings</a>
          </section>
        </main>
      </body>
    </html>
    """


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
            practice_url, unsubscribe_url = reminder_urls_for_user(user)
            email_sent = send_practice_reminder_email(user.email, practice_url, unsubscribe_url)
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

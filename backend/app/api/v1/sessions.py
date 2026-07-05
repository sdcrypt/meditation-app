from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.db.session import SessionLocal
from app.models.meditation import Meditation
from app.models.session import MeditationSession, MeditationSessionActivity
from app.schemas.session import (
    DailyActivity,
    ProgressSummary,
    SessionComplete,
    SessionHistoryItem,
    SessionHistoryResponse,
    SessionProgress,
    SessionRead,
    SessionStart,
)

router = APIRouter()
MINIMUM_STREAK_SECONDS = 60


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_owned_session(
    db: Session,
    session_id: int,
    device_id: int,
) -> MeditationSession:
    meditation_session = db.query(MeditationSession).filter(
        MeditationSession.id == session_id,
        MeditationSession.device_id == device_id,
    ).first()
    if meditation_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return meditation_session


def get_meditation_duration(db: Session, meditation_id: int) -> int:
    duration = db.query(Meditation.duration_sec).filter(
        Meditation.id == meditation_id
    ).scalar()
    if duration is None:
        raise HTTPException(status_code=404, detail="Meditation not found")
    return duration


def apply_progress(
    db: Session,
    meditation_session: MeditationSession,
    payload: SessionProgress,
    duration_sec: int,
) -> None:
    previous_seconds = meditation_session.seconds_listened
    meditation_session.last_position_sec = min(payload.position_sec, duration_sec)
    # Heartbeats can arrive out of order. Never move accumulated listening time
    # backwards, and never credit more than the meditation's full duration.
    meditation_session.seconds_listened = min(
        max(meditation_session.seconds_listened, payload.seconds_listened),
        duration_sec,
    )
    listened_delta = meditation_session.seconds_listened - previous_seconds
    if listened_delta > 0:
        meditation_session.last_listened_at = func.now()
        db.add(
            MeditationSessionActivity(
                session_id=meditation_session.id,
                seconds_listened=listened_delta,
            )
        )


def parse_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as error:
        raise HTTPException(status_code=400, detail="Invalid timezone") from error


def as_local_date(value: datetime, timezone: ZoneInfo) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(timezone).date()


def calculate_streaks(qualifying_dates: set[date], today: date) -> tuple[int, int]:
    if not qualifying_dates:
        return 0, 0

    if today in qualifying_dates:
        cursor = today
    elif today - timedelta(days=1) in qualifying_dates:
        cursor = today - timedelta(days=1)
    else:
        cursor = None

    current_streak = 0
    while cursor is not None and cursor in qualifying_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    longest_streak = 0
    running_streak = 0
    previous_date: date | None = None
    for activity_date in sorted(qualifying_dates):
        if previous_date is not None and activity_date == previous_date + timedelta(days=1):
            running_streak += 1
        else:
            running_streak = 1
        longest_streak = max(longest_streak, running_streak)
        previous_date = activity_date

    return current_streak, longest_streak


@router.post("/start", response_model=SessionRead)
def start_session(payload: SessionStart, db: Session = Depends(get_db)):
    meditation = db.query(Meditation).filter(
        Meditation.id == payload.meditation_id,
        Meditation.is_published.is_(True),
    ).first()
    if meditation is None:
        raise HTTPException(status_code=404, detail="Meditation not found")
    if not meditation.audio_url:
        raise HTTPException(status_code=409, detail="Meditation audio is unavailable")

    existing_session = db.query(MeditationSession).filter(
        MeditationSession.meditation_id == payload.meditation_id,
        MeditationSession.device_id == payload.device_id,
        MeditationSession.completed_at.is_(None),
    ).order_by(MeditationSession.started_at.desc()).first()
    if existing_session is not None:
        return existing_session

    meditation_session = MeditationSession(
        meditation_id=payload.meditation_id,
        device_id=payload.device_id,
    )
    db.add(meditation_session)
    db.commit()
    db.refresh(meditation_session)
    return meditation_session


@router.patch("/{session_id}/progress", response_model=SessionRead)
def update_progress(
    session_id: int,
    payload: SessionProgress,
    db: Session = Depends(get_db),
):
    meditation_session = get_owned_session(db, session_id, payload.device_id)
    if meditation_session.completed_at is not None:
        return meditation_session

    duration_sec = get_meditation_duration(db, meditation_session.meditation_id)
    apply_progress(db, meditation_session, payload, duration_sec)
    db.commit()
    db.refresh(meditation_session)
    return meditation_session


@router.post("/{session_id}/complete", response_model=SessionRead)
def complete_session(
    session_id: int,
    payload: SessionComplete,
    db: Session = Depends(get_db),
):
    meditation_session = get_owned_session(db, session_id, payload.device_id)
    if meditation_session.completed_at is not None:
        return meditation_session

    duration_sec = get_meditation_duration(db, meditation_session.meditation_id)
    apply_progress(db, meditation_session, payload, duration_sec)
    meditation_session.last_position_sec = duration_sec
    meditation_session.completed_at = func.now()
    db.commit()
    db.refresh(meditation_session)
    return meditation_session


@router.get("/progress/{device_id}", response_model=ProgressSummary)
def progress_summary(
    device_id: int,
    timezone_name: str = Query(default="UTC", alias="timezone", max_length=100),
    db: Session = Depends(get_db),
):
    timezone = parse_timezone(timezone_name)
    sessions = db.query(MeditationSession).filter(
        MeditationSession.device_id == device_id,
        MeditationSession.seconds_listened > 0,
    ).all()

    total_seconds = sum(item.seconds_listened for item in sessions)
    completed_sessions = sum(item.completed_at is not None for item in sessions)
    session_ids = [item.id for item in sessions]
    activity_by_date: dict[date, int] = defaultdict(int)
    sessions_with_activity: set[int] = set()

    if session_ids:
        activities = db.query(MeditationSessionActivity).filter(
            MeditationSessionActivity.session_id.in_(session_ids)
        ).all()
        for activity in activities:
            activity_date = as_local_date(activity.recorded_at, timezone)
            activity_by_date[activity_date] += activity.seconds_listened
            sessions_with_activity.add(activity.session_id)

    # Sessions created before activity-event tracking retain their historical
    # mindful time and are assigned to their best available timestamp.
    for meditation_session in sessions:
        if meditation_session.id in sessions_with_activity:
            continue
        fallback_timestamp = (
            meditation_session.completed_at
            or meditation_session.last_listened_at
            or meditation_session.started_at
        )
        activity_by_date[as_local_date(fallback_timestamp, timezone)] += (
            meditation_session.seconds_listened
        )

    completed_dates = {
        as_local_date(item.completed_at, timezone)
        for item in sessions
        if item.completed_at is not None
    }
    qualifying_dates = completed_dates | {
        activity_date
        for activity_date, seconds in activity_by_date.items()
        if seconds >= MINIMUM_STREAK_SECONDS
    }

    today = datetime.now(timezone).date()
    current_streak, longest_streak = calculate_streaks(qualifying_dates, today)
    last_7_days = []
    for days_ago in range(6, -1, -1):
        activity_date = today - timedelta(days=days_ago)
        seconds = activity_by_date.get(activity_date, 0)
        last_7_days.append(
            DailyActivity(
                date=activity_date,
                day_label=activity_date.strftime("%a")[0],
                mindful_seconds=seconds,
                mindful_minutes=round(seconds / 60),
                qualifies_for_streak=activity_date in qualifying_dates,
            )
        )

    today_seconds = activity_by_date.get(today, 0)
    return ProgressSummary(
        mindful_seconds=total_seconds,
        mindful_minutes=round(total_seconds / 60),
        total_sessions=len(sessions),
        completed_sessions=completed_sessions,
        current_streak=current_streak,
        longest_streak=longest_streak,
        today_seconds=today_seconds,
        today_minutes=round(today_seconds / 60),
        last_7_days=last_7_days,
    )


@router.get("/history/{device_id}", response_model=SessionHistoryResponse)
def session_history(
    device_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    base_query = db.query(MeditationSession, Meditation).join(
        Meditation,
        Meditation.id == MeditationSession.meditation_id,
    ).filter(
        MeditationSession.device_id == device_id,
        MeditationSession.seconds_listened > 0,
    )
    total = base_query.count()
    rows = base_query.order_by(
        func.coalesce(
            MeditationSession.last_listened_at,
            MeditationSession.completed_at,
            MeditationSession.started_at,
        ).desc(),
        MeditationSession.id.desc(),
    ).offset(offset).limit(limit).all()

    items = []
    for meditation_session, meditation in rows:
        last_activity_at = (
            meditation_session.last_listened_at
            or meditation_session.completed_at
            or meditation_session.started_at
        )
        progress_percent = min(
            100,
            round(
                meditation_session.last_position_sec
                / max(meditation.duration_sec, 1)
                * 100
            ),
        )
        items.append(
            SessionHistoryItem(
                id=meditation_session.id,
                meditation_id=meditation.id,
                title=meditation.title,
                category=meditation.category,
                teacher_name=meditation.teacher_name,
                artwork_url=meditation.artwork_url,
                meditation_duration_sec=meditation.duration_sec,
                seconds_listened=meditation_session.seconds_listened,
                last_position_sec=meditation_session.last_position_sec,
                progress_percent=progress_percent,
                started_at=meditation_session.started_at,
                last_activity_at=last_activity_at,
                completed_at=meditation_session.completed_at,
                is_completed=meditation_session.completed_at is not None,
            )
        )

    return SessionHistoryResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats/{device_id}")
def stats(device_id: int, db: Session = Depends(get_db)):
    """Backward-compatible lightweight stats endpoint."""
    total_seconds = db.query(func.sum(MeditationSession.seconds_listened)).filter(
        MeditationSession.device_id == device_id
    ).scalar() or 0
    return {"total_minutes": round(total_seconds / 60)}

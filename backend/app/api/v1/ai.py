import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_optional_user
from app.db.session import SessionLocal
from app.models.favorite import UserFavorite
from app.models.meditation import Meditation
from app.models.preference import UserPreference
from app.models.session import MeditationSession
from app.models.user import User
from app.schemas.ai import (
    AIRecommendationRequest,
    AIRecommendationResponse,
    AIRecommendedMeditation,
)

router = APIRouter()

MAX_CANDIDATES = 40
REQUEST_TIMEOUT_SECONDS = 12


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def clean_list(value) -> list[str]:
    """Return a compact list of non-empty strings from JSON columns."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def duration_matches_preference(preference: str, seconds: int) -> bool:
    if preference == "short":
        return seconds <= 600
    if preference == "medium":
        return 600 < seconds <= 1200
    if preference == "long":
        return seconds > 1200
    return True


def meditation_text(meditation: Meditation) -> str:
    values = [
        meditation.title,
        meditation.category,
        meditation.level,
        meditation.description,
        meditation.teacher_name,
        *clean_list(meditation.tags),
        *clean_list(meditation.benefits),
    ]
    return " ".join(value for value in values if value).lower()


def get_user_context(
    db: Session,
    current_user: User | None,
    device_id: int | None,
) -> dict:
    """Load compact personalization context for ranking."""
    preference = None
    favorite_ids: set[int] = set()
    completed_ids: set[int] = set()
    recent_ids: set[int] = set()
    category_counts: dict[str, int] = {}

    if current_user is not None:
        preference = db.query(UserPreference).filter(
            UserPreference.user_id == current_user.id
        ).first()
        favorite_ids = {
            item.meditation_id
            for item in db.query(UserFavorite.meditation_id)
            .filter(UserFavorite.user_id == current_user.id)
            .all()
        }
        session_query = db.query(MeditationSession, Meditation).join(
            Meditation,
            Meditation.id == MeditationSession.meditation_id,
        ).filter(MeditationSession.user_id == current_user.id)
    elif device_id is not None:
        session_query = db.query(MeditationSession, Meditation).join(
            Meditation,
            Meditation.id == MeditationSession.meditation_id,
        ).filter(
            MeditationSession.user_id.is_(None),
            MeditationSession.device_id == device_id,
        )
    else:
        session_query = None

    if session_query is not None:
        rows = session_query.filter(MeditationSession.seconds_listened > 0).all()
        for meditation_session, meditation in rows:
            category = (meditation.category or "").lower()
            if category:
                category_counts[category] = category_counts.get(category, 0) + 1
            recent_ids.add(meditation.id)
            if meditation_session.completed_at is not None:
                completed_ids.add(meditation.id)

    return {
        "preference": preference,
        "favorite_ids": favorite_ids,
        "completed_ids": completed_ids,
        "recent_ids": recent_ids,
        "category_counts": category_counts,
    }


def deterministic_recommendations(
    meditations: list[Meditation],
    user_query: str,
    context: dict,
    limit: int,
) -> list[AIRecommendedMeditation]:
    """Rank meditations locally when AI is unavailable or returns invalid data."""
    query_terms = {
        term
        for term in re.split(r"[^a-z0-9]+", user_query.lower())
        if len(term) >= 3
    }
    preference = context["preference"]

    ranked = []
    for meditation in meditations:
        text = meditation_text(meditation)
        score = 4 if meditation.is_featured else 0
        reasons: list[str] = []

        matched_terms = [term for term in query_terms if term in text]
        if matched_terms:
            score += min(30, len(matched_terms) * 8)
            reasons.append("Matches what you asked for")

        if preference is not None:
            goals = clean_list(preference.goals)
            for goal in goals:
                if goal.lower() in text:
                    score += 14
                    reasons.append(f"Fits your {goal} goal")
                    break
            if duration_matches_preference(
                preference.preferred_duration,
                meditation.duration_sec,
            ):
                score += 10
                if preference.preferred_duration:
                    reasons.append("Fits your preferred length")
            if (
                preference.experience_level
                and meditation.level.lower()
                in {preference.experience_level.lower(), "all levels"}
            ):
                score += 8
                reasons.append("Matches your experience level")

        if meditation.id in context["favorite_ids"]:
            score += 6
            reasons.append("Saved by you")
        if meditation.category.lower() in context["category_counts"]:
            score += min(8, context["category_counts"][meditation.category.lower()] * 2)
        if meditation.id in context["completed_ids"]:
            score -= 12
        if meditation.id in context["recent_ids"]:
            score -= 5

        if not reasons:
            reasons.append("A good fit from the meditation library")
        ranked.append((score, meditation.id, meditation, " · ".join(reasons[:2])))

    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [
        AIRecommendedMeditation(meditation=meditation, reason=reason)
        for _, _, meditation, reason in ranked[:limit]
    ]


def serialize_candidate(meditation: Meditation) -> dict:
    return {
        "id": meditation.id,
        "title": meditation.title,
        "category": meditation.category,
        "duration_minutes": round(meditation.duration_sec / 60),
        "level": meditation.level,
        "description": meditation.description[:500],
        "teacher": meditation.teacher_name,
        "tags": clean_list(meditation.tags)[:10],
        "benefits": clean_list(meditation.benefits)[:8],
    }


def build_ai_prompt(
    payload: AIRecommendationRequest,
    candidates: list[Meditation],
    context: dict,
) -> str:
    preference = context["preference"]
    preferences = {}
    if preference is not None:
        preferences = {
            "goals": clean_list(preference.goals),
            "preferred_duration": preference.preferred_duration,
            "experience_level": preference.experience_level,
            "preferred_practice_time": preference.preferred_practice_time,
        }

    return json.dumps(
        {
            "task": "Recommend meditations from the provided candidate list.",
            "rules": [
                "Choose only candidate IDs.",
                "Do not invent meditations.",
                "Do not diagnose the user.",
                "Do not make medical or therapeutic claims.",
                "Keep each reason warm, practical, and under 120 characters.",
            ],
            "user_request": payload.query,
            "limit": payload.limit,
            "user_preferences": preferences,
            "favorite_ids": sorted(context["favorite_ids"]),
            "completed_ids": sorted(context["completed_ids"]),
            "recently_played_ids": sorted(context["recent_ids"]),
            "candidates": [serialize_candidate(item) for item in candidates],
        },
        ensure_ascii=True,
    )


def extract_output_text(response_payload: dict) -> str:
    if isinstance(response_payload.get("output_text"), str):
        return response_payload["output_text"]

    text_parts = []
    for output in response_payload.get("output", []):
        for content in output.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                text_parts.append(text)
    return "\n".join(text_parts)


def call_openai_recommendations(
    payload: AIRecommendationRequest,
    candidates: list[Meditation],
    context: dict,
) -> list[dict]:
    """Ask OpenAI to rank candidates and return raw recommendation objects."""
    request_body = {
        "model": settings.OPENAI_MODEL,
        "store": False,
        "input": [
            {
                "role": "system",
                "content": (
                    "You are a careful meditation recommendation ranker. "
                    "Return JSON only and never provide medical advice."
                ),
            },
            {"role": "user", "content": build_ai_prompt(payload, candidates, context)},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "meditation_recommendations",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "recommendations": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": payload.limit,
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "meditation_id": {"type": "integer"},
                                    "reason": {
                                        "type": "string",
                                        "minLength": 1,
                                        "maxLength": 160,
                                    },
                                },
                                "required": ["meditation_id", "reason"],
                            },
                        }
                    },
                    "required": ["recommendations"],
                },
            }
        },
    }

    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        response_payload = json.loads(response.read().decode("utf-8"))
    output_text = extract_output_text(response_payload)
    parsed = json.loads(output_text)
    return parsed.get("recommendations", [])


def validated_ai_items(
    raw_items: list[dict],
    candidates_by_id: dict[int, Meditation],
    limit: int,
) -> list[AIRecommendedMeditation]:
    items: list[AIRecommendedMeditation] = []
    seen_ids: set[int] = set()
    for raw_item in raw_items:
        meditation_id = raw_item.get("meditation_id")
        if meditation_id in seen_ids or meditation_id not in candidates_by_id:
            continue
        reason = str(raw_item.get("reason", "")).strip()
        if not reason:
            reason = "Selected from the meditation library for this moment"
        items.append(
            AIRecommendedMeditation(
                meditation=candidates_by_id[meditation_id],
                reason=reason[:160],
            )
        )
        seen_ids.add(meditation_id)
        if len(items) >= limit:
            break
    return items


@router.post("/recommendations", response_model=AIRecommendationResponse)
def recommend_meditations(
    payload: AIRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Recommend published meditations from user intent and saved context."""
    meditations = db.query(Meditation).filter(
        Meditation.is_published.is_(True)
    ).order_by(
        Meditation.is_featured.desc(),
        Meditation.created_at.desc(),
        Meditation.id.desc(),
    ).limit(MAX_CANDIDATES).all()
    if not meditations:
        return AIRecommendationResponse(
            items=[],
            fallback=True,
            message="No published meditations are available yet.",
        )

    context = get_user_context(db, current_user, payload.device_id)
    fallback_items = deterministic_recommendations(
        meditations,
        payload.query,
        context,
        payload.limit,
    )

    if not settings.OPENAI_API_KEY:
        return AIRecommendationResponse(
            items=fallback_items,
            fallback=True,
            message="AI recommendations are not configured yet.",
        )

    try:
        raw_items = call_openai_recommendations(payload, meditations, context)
        ai_items = validated_ai_items(
            raw_items,
            {item.id: item for item in meditations},
            payload.limit,
        )
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return AIRecommendationResponse(
            items=fallback_items,
            fallback=True,
            message="Using standard recommendations while AI is unavailable.",
        )

    if not ai_items:
        return AIRecommendationResponse(
            items=fallback_items,
            fallback=True,
            message="Using standard recommendations while AI is unavailable.",
        )

    return AIRecommendationResponse(items=ai_items)

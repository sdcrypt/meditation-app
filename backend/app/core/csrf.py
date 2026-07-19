import hmac
import secrets
from hashlib import sha256

from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse

from app.core.config import settings


SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def sign_csrf_token(token: str) -> str:
    """Sign a CSRF token so the server can detect tampering."""
    return hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        token.encode("utf-8"),
        sha256,
    ).hexdigest()


def create_csrf_token() -> str:
    """Create a browser-readable CSRF token value."""
    raw_token = secrets.token_urlsafe(32)
    return f"{raw_token}.{sign_csrf_token(raw_token)}"


def validate_csrf_token(value: str | None) -> bool:
    """Check that a CSRF token has a valid signature."""
    if not value or "." not in value:
        return False
    raw_token, signature = value.rsplit(".", 1)
    expected_signature = sign_csrf_token(raw_token)
    return hmac.compare_digest(signature, expected_signature)


def set_csrf_cookie(response: Response, token: str) -> None:
    """Store the CSRF token in a readable cookie for frontend requests."""
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


async def csrf_protect(request: Request, call_next):
    """Reject unsafe cookie-auth requests that do not include a valid CSRF token."""
    if request.method in SAFE_METHODS:
        return await call_next(request)

    has_session_cookie = settings.AUTH_COOKIE_NAME in request.cookies
    if not has_session_cookie:
        return await call_next(request)

    cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_token = request.headers.get(settings.CSRF_HEADER_NAME)
    if (
        not cookie_token
        or not header_token
        or cookie_token != header_token
        or not validate_csrf_token(header_token)
    ):
        return JSONResponse(
            status_code=403,
            content={"detail": "Invalid CSRF token"},
        )

    return await call_next(request)

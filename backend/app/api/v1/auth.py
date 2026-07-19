import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.csrf import create_csrf_token, set_csrf_cookie
from app.core.dependencies import get_current_user
from app.core.rate_limit import check_rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import SessionLocal
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    AuthSession,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResult,
    UserLogin,
    UserRead,
    UserRegister,
)

router = APIRouter()
RESET_TOKEN_EXPIRE_MINUTES = 30


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_auth_cookie(response: Response, token: str) -> None:
    """Store the signed login token in a browser cookie."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Remove the browser cookie that keeps a user signed in."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
    )


def authentication_response(user: User, response: Response) -> AuthSession:
    """Sign in a user and return their public account details."""
    token = create_access_token(
        {"sub": str(user.id), "is_admin": user.is_admin}
    )
    set_auth_cookie(response, token)
    set_csrf_cookie(response, create_csrf_token())
    return AuthSession(user=user)


def hash_reset_token(token: str) -> str:
    """Create a stable fingerprint for a reset token without storing the token itself."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_password_reset_for_user(user: User, db: Session) -> str:
    """Create a fresh reset token and disable older unused tokens for the user."""
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"is_active": False})

    raw_token = secrets.token_urlsafe(48)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=datetime.now(UTC) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
            is_active=True,
        )
    )
    return raw_token


@router.post(
    "/register",
    response_model=AuthSession,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a normal user account and sign the new user in."""
    check_rate_limit(request, scope="auth:register", limit=5, window_seconds=900)
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=False,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from error
    db.refresh(user)
    return authentication_response(user, response)


@router.post("/login", response_model=AuthSession)
def login(
    payload: UserLogin,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    """Check an email and password, then sign in the matching user."""
    check_rate_limit(request, scope="auth:login", limit=10, window_seconds=900)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return authentication_response(user, response)


@router.post("/password-reset/request", response_model=PasswordResetRequestResult)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a password reset link when the email belongs to an active account."""
    check_rate_limit(request, scope="auth:password-reset-request", limit=5, window_seconds=900)
    user = db.query(User).filter(User.email == payload.email).first()
    message = "If an account exists for this email, a reset link has been prepared."
    if user is None or not user.is_active:
        return PasswordResetRequestResult(message=message)

    raw_token = create_password_reset_for_user(user, db)
    db.commit()

    reset_url = f"{settings.PASSWORD_RESET_URL_BASE}?token={raw_token}"
    return PasswordResetRequestResult(
        message=message,
        reset_url=reset_url,
    )


@router.post("/password-reset/confirm", response_model=AuthSession)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    """Accept a valid reset token, change the password, and sign the user in."""
    check_rate_limit(request, scope="auth:password-reset-confirm", limit=10, window_seconds=900)
    token_hash = hash_reset_token(payload.token)
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.is_active.is_(True),
    ).first()
    if reset_token is None or reset_token.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    user = db.query(User).filter(
        User.id == reset_token.user_id,
        User.is_active.is_(True),
    ).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    user.hashed_password = hash_password(payload.password)
    reset_token.used_at = datetime.now(UTC)
    reset_token.is_active = False
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != reset_token.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"is_active": False})
    db.commit()
    db.refresh(user)
    return authentication_response(user, response)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the account that belongs to the current session."""
    return current_user


@router.get("/csrf")
def get_csrf_token(response: Response):
    """Return a CSRF token that frontend requests can send back in a header."""
    token = create_csrf_token()
    set_csrf_cookie(response, token)
    return {"csrf_token": token}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """Sign the current browser out by clearing its session cookie."""
    clear_auth_cookie(response)
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return None

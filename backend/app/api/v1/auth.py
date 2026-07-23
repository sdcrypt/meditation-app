import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.csrf import create_csrf_token, set_csrf_cookie
from app.core.dependencies import get_current_user
from app.core.logging import get_logger
from app.core.rate_limit import check_rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import SessionLocal
from app.models.email_verification import EmailVerificationToken
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    AuthSession,
    EmailVerificationConfirm,
    EmailVerificationResult,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResult,
    UserLogin,
    UserRead,
    UserRegister,
)
from app.services.email_service import send_email_verification_email, send_password_reset_email

router = APIRouter()
logger = get_logger(__name__)
RESET_TOKEN_EXPIRE_MINUTES = 30
VERIFICATION_TOKEN_EXPIRE_HOURS = 24


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


def hash_verification_token(token: str) -> str:
    """Create a stable fingerprint for a verification token."""
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


def create_email_verification_for_user(user: User, db: Session) -> str:
    """Create a fresh email verification token and disable older unused tokens."""
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used_at.is_(None),
    ).update({"is_active": False})

    raw_token = secrets.token_urlsafe(48)
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_verification_token(raw_token),
            expires_at=datetime.now(UTC) + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS),
            is_active=True,
        )
    )
    return raw_token


def verification_url_for_token(raw_token: str) -> str:
    """Build the frontend URL where a user can verify their email."""
    return f"{settings.EMAIL_VERIFICATION_URL_BASE}?token={raw_token}"


def send_verification_for_user(user: User, db: Session) -> tuple[bool, str | None]:
    """Create and send a verification link for a user who is not verified."""
    if user.email_verified_at is not None:
        return False, None
    raw_token = create_email_verification_for_user(user, db)
    verification_url = verification_url_for_token(raw_token)
    email_sent = send_email_verification_email(user.email, verification_url)
    return email_sent, verification_url


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
    db.flush()
    verification_url = None
    try:
        _, verification_url = send_verification_for_user(user, db)
    except RuntimeError as error:
        logger.warning("Unable to send verification email during registration: %s", error)
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
    message = "If an account exists for this email, a reset link has been sent."
    if user is None or not user.is_active:
        return PasswordResetRequestResult(message=message)

    raw_token = create_password_reset_for_user(user, db)
    reset_url = f"{settings.PASSWORD_RESET_URL_BASE}?token={raw_token}"
    try:
        email_sent = send_password_reset_email(user.email, reset_url)
    except RuntimeError as error:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Password reset email could not be sent. Please try again later.",
        ) from error

    db.commit()
    should_return_dev_link = settings.APP_ENV.lower() != "production" and not email_sent
    return PasswordResetRequestResult(
        message=message,
        reset_url=reset_url if should_return_dev_link else None,
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


@router.post("/email-verification/resend", response_model=EmailVerificationResult)
def resend_email_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a new verification email to the signed-in user."""
    check_rate_limit(request, scope="auth:email-verification-resend", limit=5, window_seconds=900)
    if current_user.email_verified_at is not None:
        return EmailVerificationResult(message="Your email is already verified.")

    try:
        email_sent, verification_url = send_verification_for_user(current_user, db)
    except RuntimeError as error:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Verification email could not be sent. Please try again later.",
        ) from error

    db.commit()
    should_return_dev_link = settings.APP_ENV.lower() != "production" and not email_sent
    return EmailVerificationResult(
        message="Verification email sent.",
        verification_url=verification_url if should_return_dev_link else None,
    )


@router.post("/email-verification/confirm", response_model=EmailVerificationResult)
def confirm_email_verification(
    payload: EmailVerificationConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    """Confirm a user's email address with a valid verification token."""
    check_rate_limit(request, scope="auth:email-verification-confirm", limit=10, window_seconds=900)
    raw_token = payload.token.strip()
    token_hash = hash_verification_token(raw_token)
    verification_token = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token_hash == token_hash,
        EmailVerificationToken.used_at.is_(None),
        EmailVerificationToken.is_active.is_(True),
    ).first()
    if verification_token is None or verification_token.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired")

    user = db.query(User).filter(
        User.id == verification_token.user_id,
        User.is_active.is_(True),
    ).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired")

    now = datetime.now(UTC)
    user.email_verified_at = user.email_verified_at or now
    verification_token.used_at = now
    verification_token.is_active = False
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.id != verification_token.id,
        EmailVerificationToken.used_at.is_(None),
    ).update({"is_active": False})
    db.commit()
    return EmailVerificationResult(message="Email verified successfully.")


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

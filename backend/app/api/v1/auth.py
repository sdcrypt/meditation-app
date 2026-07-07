from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.auth import AuthSession, UserLogin, UserRead, UserRegister

router = APIRouter()


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
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Remove the browser cookie that keeps a user signed in."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def authentication_response(user: User, response: Response) -> AuthSession:
    """Sign in a user and return their public account details."""
    token = create_access_token(
        {"sub": str(user.id), "is_admin": user.is_admin}
    )
    set_auth_cookie(response, token)
    return AuthSession(user=user)


@router.post(
    "/register",
    response_model=AuthSession,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    response: Response,
    db: Session = Depends(get_db),
):
    """Create a normal user account and sign the new user in."""
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
    db: Session = Depends(get_db),
):
    """Check an email and password, then sign in the matching user."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return authentication_response(user, response)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the account that belongs to the current session."""
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """Sign the current browser out by clearing its session cookie."""
    clear_auth_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None

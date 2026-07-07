from fastapi import Cookie, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import SECRET_KEY, ALGORITHM
from app.db.session import SessionLocal
from app.models.user import User


security = HTTPBearer(auto_error=False)


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    cookie_token: str | None = Cookie(default=None, alias=settings.AUTH_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    """Find the user who belongs to the current token or session cookie."""
    token = credentials.credentials if credentials else cookie_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if not subject:
            raise ValueError("Missing subject")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if str(subject).isdigit():
        user = db.query(User).filter(User.id == int(subject)).first()
    else:
        # Compatibility for administrator tokens issued before user accounts.
        user = db.query(User).filter(User.email == subject).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    return user


def require_admin(user=Depends(get_current_user)):
    """Allow the request only when the current user is an administrator."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user

from datetime import UTC, datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str):
    """Turn a plain password into a safe value for storage."""
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    """Check whether a plain password matches the saved password."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    """Create a signed login token that expires after the configured time."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

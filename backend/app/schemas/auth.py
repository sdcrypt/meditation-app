import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserLogin(BaseModel):
    """Email and password entered on the sign-in form."""
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Store email addresses in a consistent lowercase form."""
        return str(value).strip().lower()


class UserRegister(BaseModel):
    """Email and password entered when creating a new account."""
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Store email addresses in a consistent lowercase form."""
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Make sure new account passwords meet the basic safety rules."""
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 bytes")
        if not re.search(r"[a-z]", value):
            raise ValueError("password must include a lowercase letter")
        if not re.search(r"[A-Z]", value):
            raise ValueError("password must include an uppercase letter")
        if not re.search(r"\d", value):
            raise ValueError("password must include a number")
        return value


class UserRead(BaseModel):
    """Public account details that are safe to send to the frontend."""
    id: int
    email: EmailStr
    is_admin: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Legacy token response kept for direct API compatibility."""
    access_token: str
    token_type: str
    user: UserRead


class AuthSession(BaseModel):
    """Account details returned after cookie-based login or registration."""
    user: UserRead


class PasswordResetRequest(BaseModel):
    """Email entered when a user asks to reset their password."""
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Use the same lowercase email format as login and registration."""
        return str(value).strip().lower()


class PasswordResetRequestResult(BaseModel):
    """Response after a reset request is accepted."""
    message: str
    reset_url: str | None = None


class PasswordResetConfirm(BaseModel):
    """Token and new password entered from the reset screen."""
    token: str = Field(min_length=20, max_length=300)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Require the same password strength used during registration."""
        return UserRegister.validate_password_strength(value)

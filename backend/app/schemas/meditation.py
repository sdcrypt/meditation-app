from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PLACEHOLDER_LIST_VALUES = {"[]", "{}", "null", "none", "undefined", "-", "n/a", "na"}


def _normalize_url(value: str | None) -> str | None:
    """Clean a URL and make sure it points to a web address."""
    if value is None:
        return None

    value = value.strip()
    if not value:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("must be an absolute HTTP or HTTPS URL")
    return value


def _normalize_string_list(
    value: list[str] | None,
    *,
    field_name: str,
    max_items: int,
    item_max_length: int,
    lowercase: bool = False,
) -> list[str] | None:
    """Clean a list of short text items and remove duplicates."""
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be a list of strings")

    normalized: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"{field_name} must contain only strings")
        item = item.strip()
        if not item:
            continue
        if item.casefold() in PLACEHOLDER_LIST_VALUES:
            continue
        if len(item) > item_max_length:
            raise ValueError(
                f"each {field_name} item must be at most {item_max_length} characters"
            )
        if lowercase:
            item = item.lower()
        deduplication_key = item.casefold()
        if deduplication_key not in seen:
            seen.add(deduplication_key)
            normalized.append(item)

    if len(normalized) > max_items:
        raise ValueError(f"{field_name} must contain at most {max_items} items")
    return normalized


class MeditationBase(BaseModel):
    """Shared meditation fields used by create, update, and read schemas."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=80)
    duration_sec: int = Field(gt=0, le=86_400)
    level: str = Field(min_length=1, max_length=50)
    audio_url: str | None = None
    description: str = Field(default="", max_length=5_000)
    teacher_name: str = Field(default="", max_length=120)
    artwork_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    is_featured: bool = False

    @field_validator("audio_url", "artwork_url", mode="before")
    @classmethod
    def validate_urls(cls, value: str | None) -> str | None:
        """Accept only valid web URLs for audio and artwork."""
        return _normalize_url(value)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str]:
        """Clean tags so search and personalization can use them."""
        return _normalize_string_list(
            value,
            field_name="tags",
            max_items=20,
            item_max_length=50,
            lowercase=True,
        ) or []

    @field_validator("benefits", mode="before")
    @classmethod
    def validate_benefits(cls, value: list[str] | None) -> list[str]:
        """Clean benefit text shown to users on cards and detail pages."""
        return _normalize_string_list(
            value,
            field_name="benefits",
            max_items=12,
            item_max_length=160,
        ) or []


class MeditationCreate(MeditationBase):
    """Fields accepted when an administrator creates a meditation."""
    is_published: bool = True


class MeditationUpdate(BaseModel):
    """Fields accepted when an administrator edits a meditation."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    duration_sec: int | None = Field(default=None, gt=0, le=86_400)
    level: str | None = Field(default=None, min_length=1, max_length=50)
    audio_url: str | None = None
    description: str | None = Field(default=None, max_length=5_000)
    teacher_name: str | None = Field(default=None, max_length=120)
    artwork_url: str | None = None
    tags: list[str] | None = None
    benefits: list[str] | None = None
    is_featured: bool | None = None
    is_published: bool | None = None

    @field_validator("audio_url", "artwork_url", mode="before")
    @classmethod
    def validate_urls(cls, value: str | None) -> str | None:
        """Accept only valid web URLs for audio and artwork."""
        return _normalize_url(value)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        """Clean tags when they are included in an update."""
        return _normalize_string_list(
            value,
            field_name="tags",
            max_items=20,
            item_max_length=50,
            lowercase=True,
        )

    @field_validator("benefits", mode="before")
    @classmethod
    def validate_benefits(cls, value: list[str] | None) -> list[str] | None:
        """Clean benefit text when it is included in an update."""
        return _normalize_string_list(
            value,
            field_name="benefits",
            max_items=12,
            item_max_length=160,
        )

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        """Prevent required fields from being cleared by accident."""
        nullable_fields = {"audio_url", "artwork_url"}
        for field_name in self.model_fields_set - nullable_fields:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class MeditationRead(MeditationBase):
    """Meditation details returned by public and admin APIs."""
    id: int
    is_published: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

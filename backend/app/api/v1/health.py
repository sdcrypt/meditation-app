from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def health_check():
    """Return a simple message that confirms the API is running."""
    return {
        "status": "ok",
        "service": "meditation-api",
    }

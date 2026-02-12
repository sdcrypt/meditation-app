"""
Uvicorn entrypoint.

This repo's FastAPI app lives in `backend/app/main.py`.
Having this shim allows running:

  uvicorn main:app --reload

from within the `backend/` directory.
"""

from app.main import app  # noqa: F401


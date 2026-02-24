from fastapi import APIRouter
from app.api.v1 import sessions

from app.api.v1 import health, meditations
from app.api.v1.admin import meditations as admin_meditations
from app.api.v1 import auth

api_router = APIRouter()

api_router.include_router(
    health.router, 
    prefix="/health", 
    tags=["Health"]
    )
    
api_router.include_router(
    meditations.router, 
    prefix="/meditations", 
    tags=["Meditations"]
    )

api_router.include_router(
    admin_meditations.router,
    prefix="/admin/meditations",
    tags=["Admin"],
)

api_router.include_router(
    sessions.router,
    prefix="/sessions",
    tags=["Sessions"],
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Auth"],
)
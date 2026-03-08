"""Health check route."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "api_version": settings.API_VERSION,
    }

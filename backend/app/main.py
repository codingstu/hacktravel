"""FastAPI application factory.

Wires up routes, middleware, lifespan events.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import RequestIDMiddleware
from app.routes import health, itinerary
from app.services.cache_service import cache_service

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting %s (%s)", settings.APP_NAME, settings.APP_ENV)
    await cache_service.connect()
    yield
    await cache_service.close()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=f"v{settings.API_VERSION}",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routes ───────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(itinerary.router)

    return app


app = create_app()

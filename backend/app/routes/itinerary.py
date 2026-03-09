"""Itinerary API routes.

POST /v1/itineraries/generate — aligned with blueprint Section 3.1 / 3.2.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Header, Request
from pydantic import ValidationError

from app.core.config import settings
from app.core.exceptions import (
    FallbackCacheMissError,
    ModelUnavailableError,
    RateLimitedError,
    SchemaValidationError,
)
from app.models.itinerary import (
    ErrorResponse,
    ItineraryGenerateRequest,
    ItineraryGenerateResponse,
)
from app.services.cache_service import cache_service
from app.services.itinerary_service import itinerary_service
from app.services.preset_routes import get_featured_sub_regions, get_region_metadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/itineraries", tags=["itineraries"])


@router.get("/regions")
async def get_itinerary_regions() -> dict:
    """Return continent and sub-region metadata for preset exploration."""
    return {
        "default_continent": "Asia",
        "continents": get_region_metadata(),
        "featured_sub_regions": get_featured_sub_regions(),
    }


@router.post(
    "/generate",
    response_model=ItineraryGenerateResponse,
    responses={
        429: {"model": ErrorResponse, "description": "Rate limited"},
        503: {"model": ErrorResponse, "description": "Model unavailable"},
        599: {"model": ErrorResponse, "description": "Fallback cache miss"},
    },
)
async def generate_itinerary(
    body: ItineraryGenerateRequest,
    request: Request,
    x_api_version: int = Header(default=1, alias="X-Api-Version"),
) -> ItineraryGenerateResponse:
    """Generate an itinerary from user parameters via LLM with cache & failover."""

    request_id: str = getattr(request.state, "request_id", "unknown")
    client_ip = request.client.host if request.client else "unknown"

    # ── Rate limiting ────────────────────────────────────
    # Only enforce rate limit for requests that may invoke LLM (expensive).
    # Preset / cache hits are free — don't burn rate limit quota on them.
    allowed = await cache_service.check_rate_limit(
        identifier=client_ip,
        limit=settings.RATE_LIMIT_ANONYMOUS,
    )

    # ── Generation pipeline ──────────────────────────────
    try:
        response = await itinerary_service.generate(req=body, request_id=request_id)

        # If the response came from preset or cache, refund the rate-limit token
        is_free = getattr(response.source, "is_preset", False) or response.source.cache_hit
        if is_free:
            await cache_service.refund_rate_limit(client_ip)

        return response
    except RuntimeError as exc:
        # All LLM providers failed AND cache fallback missed
        if not allowed:
            # If we're actually over the limit AND LLM is needed, enforce the limit
            raise RateLimitedError(
                message="Rate limit exceeded. Try again later.",
                request_id=request_id,
                retry_after=60,
            )
        logger.error("[%s] Generation totally failed: %s", request_id, exc)
        raise FallbackCacheMissError(request_id=request_id)
    except ValidationError as exc:
        logger.error("[%s] Schema validation: %s", request_id, str(exc)[:300])
        raise SchemaValidationError(message=str(exc)[:500], request_id=request_id)
    except ValueError as exc:
        logger.error("[%s] Value error: %s", request_id, exc)
        raise ModelUnavailableError(message=str(exc)[:300], request_id=request_id)

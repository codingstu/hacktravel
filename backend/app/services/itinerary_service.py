"""Itinerary generation service – orchestrates cache, LLM, validation.

Read/write path (blueprint Section 8.3):
1. Check idempotency key
2. Check cache (query_hash)
3. Cache miss → call LLM gateway
4. Pydantic first-pass validation
5. Business rules second-pass validation
6. Write to cache
7. Return response

Fallback: if all LLM providers fail, try reading historical cache.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.models.itinerary import (
    Currency,
    ItineraryGenerateRequest,
    ItineraryGenerateResponse,
    ItineraryLeg,
    ItinerarySummary,
    MapInfo,
    Money,
    Place,
    PolicyInfo,
    SourceInfo,
)
from app.services.cache_service import CacheService, cache_service
from app.services.llm_gateway import LLMGateway, llm_gateway
from app.services.preset_routes import find_preset
from app.utils.google_maps import build_google_maps_url

logger = logging.getLogger(__name__)


class ItineraryService:
    """Core itinerary generation orchestrator."""

    def __init__(
        self,
        cache: CacheService | None = None,
        llm: LLMGateway | None = None,
    ) -> None:
        self.cache = cache or cache_service
        self.llm = llm or llm_gateway

    async def generate(
        self, req: ItineraryGenerateRequest, request_id: str
    ) -> ItineraryGenerateResponse:
        """Full generation pipeline.

        Priority: preset (0ms) → idempotency → cache → LLM (10-60s)
        """

        # 0. Preset lookup — instant response for popular routes
        #    Skip if caller explicitly wants AI generation (skip_preset=True)
        preset_result = None if req.skip_preset else find_preset(
            destination=req.destination,
            total_hours=req.total_hours,
            budget_amount=req.budget.amount,
            budget_currency=req.budget.currency.value,
            tags=req.tags,
        )
        if preset_result:
            logger.info(
                "[%s] Preset hit for dest=%s hours=%d",
                request_id, req.destination, req.total_hours,
            )
            # Still write idempotency so repeated clicks don't re-process
            await self.cache.set_idempotency(
                req.idempotency_key, preset_result.model_dump()
            )
            return preset_result

        # 1. Idempotency check
        cached_response = await self.cache.check_idempotency(req.idempotency_key)
        if cached_response:
            logger.info("[%s] Idempotency hit for key=%s", request_id, req.idempotency_key)
            cached_response.setdefault("source", {})
            cached_response["source"]["cache_hit"] = True
            return ItineraryGenerateResponse(**cached_response)

        # 2. Cache check
        query_hash = CacheService.build_query_hash(
            destination=req.destination,
            total_hours=req.total_hours,
            budget_amount=req.budget.amount,
            budget_currency=req.budget.currency.value,
            tags=req.tags,
        )

        cached_itinerary = await self.cache.get_cached_itinerary(query_hash)
        if cached_itinerary:
            response = self._build_response_from_cache(cached_itinerary, request_id)
            await self.cache.set_idempotency(req.idempotency_key, response.model_dump())
            return response

        # 3. LLM call with failover
        try:
            llm_result = await self.llm.generate(
                origin=req.origin,
                destination=req.destination,
                total_hours=req.total_hours,
                budget_amount=req.budget.amount,
                budget_currency=req.budget.currency.value,
                tags=req.tags,
                locale=req.locale,
                timezone=req.timezone,
            )
        except RuntimeError:
            # All providers failed – try historical cache fallback
            logger.warning("[%s] All LLM providers failed, attempting cache fallback", request_id)
            if cached_itinerary := await self.cache.get_cached_itinerary(query_hash):
                return self._build_response_from_cache(cached_itinerary, request_id)
            raise

        # 4. Pydantic first-pass validation
        raw_data = llm_result.parsed_json
        if raw_data is None:
            raise ValueError("LLM returned no parseable JSON")

        validated_legs = self._validate_legs(raw_data.get("legs", []))

        # 5. Business rules second-pass
        self._validate_business_rules(validated_legs, req)

        # 6. Build response
        itinerary_id = str(uuid.uuid4())

        # Build Google Maps deeplink
        places = [leg.place for leg in validated_legs if leg.place]
        maps_url = build_google_maps_url(places)

        source_info = SourceInfo(
            llm_provider=llm_result.provider_name,
            model_name=llm_result.model_name,
            cache_hit=False,
        )

        summary_data = raw_data.get("summary", {})
        total_cost_data = summary_data.get("estimated_total_cost", {})

        response = ItineraryGenerateResponse(
            itinerary_id=itinerary_id,
            title=raw_data.get("title", f"{req.destination} {req.total_hours}H 极限路线"),
            summary=ItinerarySummary(
                total_hours=req.total_hours,
                estimated_total_cost=Money(
                    amount=total_cost_data.get("amount", sum(l.estimated_cost.amount for l in validated_legs)),
                    currency=total_cost_data.get("currency", req.budget.currency.value),
                ),
            ),
            legs=validated_legs,
            map=MapInfo(
                google_maps_deeplink=maps_url,
                waypoints_count=len(places),
            ),
            source=source_info,
        )

        # 7. Write to cache
        response_dict = response.model_dump()
        await self.cache.set_cached_itinerary(query_hash, response_dict)
        await self.cache.set_idempotency(req.idempotency_key, response_dict)

        logger.info(
            "[%s] Itinerary generated: id=%s provider=%s latency=%dms switches=%d",
            request_id,
            itinerary_id,
            llm_result.provider_name,
            llm_result.latency_ms,
            llm_result.switch_count,
        )

        return response

    # ── Validation helpers ───────────────────────────────

    def _validate_legs(self, raw_legs: list[dict]) -> list[ItineraryLeg]:
        """Pydantic first-pass: parse each leg."""
        validated: list[ItineraryLeg] = []
        for i, leg_data in enumerate(raw_legs):
            leg_data.setdefault("index", i)
            try:
                validated.append(ItineraryLeg(**leg_data))
            except ValidationError as e:
                logger.warning("Leg %d validation failed: %s", i, str(e)[:200])
                # Attempt to salvage: fill minimal defaults
                leg_data.setdefault("activity_type", "attraction")
                leg_data.setdefault("estimated_cost", {"amount": 0, "currency": "CNY"})
                leg_data.setdefault("place", {"name": f"Unknown Place {i}"})
                validated.append(ItineraryLeg(**leg_data))
        return validated

    def _validate_business_rules(
        self,
        legs: list[ItineraryLeg],
        req: ItineraryGenerateRequest,
    ) -> None:
        """Business rules second-pass validation (logs warnings, does not reject)."""
        total_cost = sum(leg.estimated_cost.amount for leg in legs)
        if total_cost > req.budget.amount * 1.2:  # 20% tolerance
            logger.warning(
                "Total cost %.2f exceeds budget %.2f by >20%%",
                total_cost,
                req.budget.amount,
            )

        if len(legs) == 0:
            raise ValueError("LLM returned zero legs – empty itinerary")

    # ── Cache response builder ───────────────────────────

    def _build_response_from_cache(
        self, data: dict[str, Any], request_id: str
    ) -> ItineraryGenerateResponse:
        """Wrap cached data; mark source as cache hit."""
        data["source"] = data.get("source", {})
        data["source"]["cache_hit"] = True
        logger.info("[%s] Returning cached itinerary", request_id)
        return ItineraryGenerateResponse(**data)


# Singleton
itinerary_service = ItineraryService()

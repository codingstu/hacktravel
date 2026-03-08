"""Redis-based cache service for itinerary results.

Implements query_hash normalization, TTL by destination popularity, 
and idempotency key protection.

Aligned with blueprint Section 2.3, 8.3, and 16.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Key prefixes
_CACHE_PREFIX = "hkt:cache:"
_IDEMPOTENCY_PREFIX = "hkt:idem:"
_RATE_LIMIT_PREFIX = "hkt:rl:"

# Idempotency window
_IDEMPOTENCY_TTL = 600  # 10 minutes


class CacheService:
    """Async Redis cache wrapper."""

    def __init__(self) -> None:
        self._pool: redis.Redis | None = None

    async def connect(self) -> None:
        self._pool = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("Redis connected: %s", settings.REDIS_URL)

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    @property
    def _r(self) -> redis.Redis:
        if self._pool is None:
            raise RuntimeError("CacheService not connected – call connect() first")
        return self._pool

    # ── Query hash ───────────────────────────────────────

    @staticmethod
    def build_query_hash(
        destination: str,
        total_hours: int,
        budget_amount: float,
        budget_currency: str,
        tags: list[str],
    ) -> str:
        """Normalize query parameters into a deterministic hash.

        Rounding budget to nearest 50 unit to increase cache hit rate.
        """
        norm_budget = round(budget_amount / 50) * 50
        norm_tags = ",".join(sorted(t.lower().strip() for t in tags))
        raw = f"{destination.lower().strip()}|{total_hours}|{norm_budget}|{budget_currency}|{norm_tags}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    # ── Itinerary cache ──────────────────────────────────

    async def get_cached_itinerary(self, query_hash: str) -> dict[str, Any] | None:
        key = f"{_CACHE_PREFIX}{query_hash}"
        raw = await self._r.get(key)
        if raw:
            logger.info("Cache HIT for query_hash=%s", query_hash)
            return json.loads(raw)
        logger.info("Cache MISS for query_hash=%s", query_hash)
        return None

    async def set_cached_itinerary(
        self,
        query_hash: str,
        data: dict[str, Any],
        ttl: int | None = None,
    ) -> None:
        key = f"{_CACHE_PREFIX}{query_hash}"
        if ttl is None:
            ttl = settings.CACHE_TTL_HOT
        await self._r.set(key, json.dumps(data, ensure_ascii=False), ex=ttl)
        logger.info("Cache SET for query_hash=%s (ttl=%d)", query_hash, ttl)

    # ── Idempotency ──────────────────────────────────────

    async def check_idempotency(self, key: str) -> dict[str, Any] | None:
        """Return cached response for idempotency key, or None."""
        raw = await self._r.get(f"{_IDEMPOTENCY_PREFIX}{key}")
        if raw:
            return json.loads(raw)
        return None

    async def set_idempotency(self, key: str, data: dict[str, Any]) -> None:
        await self._r.set(
            f"{_IDEMPOTENCY_PREFIX}{key}",
            json.dumps(data, ensure_ascii=False),
            ex=_IDEMPOTENCY_TTL,
        )

    # ── Rate limiting (sliding window) ───────────────────

    async def check_rate_limit(self, identifier: str, limit: int) -> bool:
        """Return True if request is allowed, False if rate-limited.

        Uses a simple counter with 1-hour expiry.
        """
        key = f"{_RATE_LIMIT_PREFIX}{identifier}"
        current = await self._r.incr(key)
        if current == 1:
            await self._r.expire(key, 3600)
        return current <= limit

    async def get_rate_limit_remaining(self, identifier: str, limit: int) -> int:
        key = f"{_RATE_LIMIT_PREFIX}{identifier}"
        current = await self._r.get(key)
        if current is None:
            return limit
        return max(0, limit - int(current))


# Singleton
cache_service = CacheService()

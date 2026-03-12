"""Profile service — Tab4 用户中心 Redis 持久化.

Redis keys:
- hkt:profile:{device_hash}           → HASH (name, tagline, avatar_url, countries_visited)
- hkt:profile:stats:{device_hash}     → HASH (trips, saved, reviews)
- hkt:profile:prefs:{device_hash}     → HASH (dark_mode, language, currency)
- hkt:profile:itineraries:{device_hash} → ZSET (itinerary_id scored by saved_at timestamp)
- hkt:profile:itinerary:{itinerary_id}  → HASH (itinerary details)
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from app.models.profile import SavedItineraryContext
from app.models.itinerary import ItineraryGenerateResponse

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_KEY_PROFILE = "hkt:profile:{}"
_KEY_STATS = "hkt:profile:stats:{}"
_KEY_PREFS = "hkt:profile:prefs:{}"
_KEY_ITINERARIES = "hkt:profile:itineraries:{}"
_KEY_ITINERARY = "hkt:profile:itinerary:{}"

MAX_SAVED_ITINERARIES = 50
PROFILE_TTL = 365 * 86400  # 1 year


def _hash_device(device_id: str) -> str:
    """Hash device_id for key construction."""
    return hashlib.sha256(device_id.strip().encode()).hexdigest()[:16]


class ProfileService:
    """User profile CRUD backed by Redis."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    # ── Profile CRUD ──────────────────────────────────────

    async def get_profile(self, device_id: str) -> tuple[dict, bool]:
        """Get or create user profile. Returns (profile_data, is_new)."""
        device_hash = _hash_device(device_id)
        key = _KEY_PROFILE.format(device_hash)

        data = await self.redis.hgetall(key)
        if data:
            data["device_id"] = device_id
            data["email"] = data.get("email", "")
            data["countries_visited"] = int(data.get("countries_visited", 0))
            return data, False

        # Create default profile
        default = {
            "device_id": device_id,
            "name": "Traveler",
            "tagline": "Travel Enthusiast",
            "avatar_url": "",
            "email": "",
            "countries_visited": "0",
        }
        await self.redis.hset(key, mapping=default)
        await self.redis.expire(key, PROFILE_TTL)

        # Initialize stats
        stats_key = _KEY_STATS.format(device_hash)
        await self.redis.hset(
            stats_key,
            mapping={
                "trips": "0",
                "saved": "0",
                "reviews": "0",
            },
        )
        await self.redis.expire(stats_key, PROFILE_TTL)

        # Initialize preferences
        prefs_key = _KEY_PREFS.format(device_hash)
        await self.redis.hset(
            prefs_key,
            mapping={
                "dark_mode": "false",
                "language": "en",
                "currency": "USD",
            },
        )
        await self.redis.expire(prefs_key, PROFILE_TTL)

        default["countries_visited"] = 0
        logger.info("Created new profile for device %s***", device_hash[:6])
        return default, True

    async def update_profile(
        self,
        device_id: str,
        name: Optional[str] = None,
        tagline: Optional[str] = None,
        avatar_url: Optional[str] = None,
        email: Optional[str] = None,
        countries_visited: Optional[int] = None,
    ) -> dict:
        """Update user profile fields."""
        device_hash = _hash_device(device_id)
        key = _KEY_PROFILE.format(device_hash)

        # Ensure profile exists
        exists = await self.redis.exists(key)
        if not exists:
            await self.get_profile(device_id)

        updates: dict[str, str] = {}
        if name is not None:
            updates["name"] = name
        if tagline is not None:
            updates["tagline"] = tagline
        if avatar_url is not None:
            updates["avatar_url"] = avatar_url
        if email is not None:
            updates["email"] = email
        if countries_visited is not None:
            updates["countries_visited"] = str(countries_visited)

        if updates:
            await self.redis.hset(key, mapping=updates)
            await self.redis.expire(key, PROFILE_TTL)

        data = await self.redis.hgetall(key)
        data["device_id"] = device_id
        data["email"] = data.get("email", "")
        data["countries_visited"] = int(data.get("countries_visited", 0))
        return data

    # ── Stats ─────────────────────────────────────────────

    async def get_stats(self, device_id: str) -> dict:
        """Get user stats.

        `saved` is always derived from the real itinerary ZSET size to stay
        in sync even if the counter diverged (e.g. duplicate saves, race
        conditions, or manual Redis edits).
        """
        device_hash = _hash_device(device_id)
        stats_key = _KEY_STATS.format(device_hash)

        data = await self.redis.hgetall(stats_key)
        if not data:
            # Ensure profile exists first
            await self.get_profile(device_id)
            data = await self.redis.hgetall(stats_key)

        # Compute saved from real itinerary ZSET — source of truth
        itin_list_key = _KEY_ITINERARIES.format(device_hash)
        real_saved = await self.redis.zcard(itin_list_key)

        # Auto-correct stored counter so future deletes stay accurate
        await self.redis.hset(stats_key, "saved", str(real_saved))

        return {
            "trips": int(data.get("trips", 0)),
            "saved": real_saved,
            "reviews": int(data.get("reviews", 0)),
        }

    async def increment_stat(self, device_id: str, field: str, amount: int = 1) -> None:
        """Increment a stat counter."""
        device_hash = _hash_device(device_id)
        stats_key = _KEY_STATS.format(device_hash)
        await self.redis.hincrby(stats_key, field, amount)

    # ── Preferences ───────────────────────────────────────

    async def get_preferences(self, device_id: str) -> dict:
        """Get user preferences."""
        device_hash = _hash_device(device_id)
        prefs_key = _KEY_PREFS.format(device_hash)

        data = await self.redis.hgetall(prefs_key)
        if not data:
            await self.get_profile(device_id)
            data = await self.redis.hgetall(prefs_key)

        return {
            "dark_mode": data.get("dark_mode", "false") == "true",
            "language": data.get("language", "en"),
            "currency": data.get("currency", "USD"),
        }

    async def update_preferences(
        self,
        device_id: str,
        dark_mode: Optional[bool] = None,
        language: Optional[str] = None,
        currency: Optional[str] = None,
    ) -> dict:
        """Update user preferences."""
        device_hash = _hash_device(device_id)
        prefs_key = _KEY_PREFS.format(device_hash)

        # Ensure profile exists
        exists = await self.redis.exists(prefs_key)
        if not exists:
            await self.get_profile(device_id)

        updates: dict[str, str] = {}
        if dark_mode is not None:
            updates["dark_mode"] = "true" if dark_mode else "false"
        if language is not None:
            updates["language"] = language
        if currency is not None:
            updates["currency"] = currency

        if updates:
            await self.redis.hset(prefs_key, mapping=updates)
            await self.redis.expire(prefs_key, PROFILE_TTL)

        return await self.get_preferences(device_id)

    # ── Saved Itineraries ─────────────────────────────────

    async def save_itinerary(
        self,
        device_id: str,
        itinerary_id: str,
        title: str,
        destination: str,
        stops: int = 0,
        days: int = 0,
        cover_image: Optional[str] = None,
        context: Optional[SavedItineraryContext] = None,
        generated: Optional[ItineraryGenerateResponse] = None,
    ) -> dict:
        """Save an itinerary to user's collection."""
        device_hash = _hash_device(device_id)
        itin_list_key = _KEY_ITINERARIES.format(device_hash)

        # Check limit
        count = await self.redis.zcard(itin_list_key)
        if count >= MAX_SAVED_ITINERARIES:
            return {
                "success": False,
                "message": f"最多保存 {MAX_SAVED_ITINERARIES} 条行程",
                "itinerary_id": "",
            }

        # Detect duplicate: itinerary_id already in user's list
        already_saved = await self.redis.zscore(itin_list_key, itinerary_id)
        if already_saved is not None:
            return {
                "success": True,
                "message": "行程已在收藏中",
                "itinerary_id": itinerary_id,
            }

        now = datetime.now(timezone.utc)
        saved_at = now.isoformat()
        ts = now.timestamp()

        # Store itinerary details
        itin_key = _KEY_ITINERARY.format(itinerary_id)
        itin_data = {
            "itinerary_id": itinerary_id,
            "title": title,
            "destination": destination,
            "stops": str(stops),
            "days": str(days),
            "cover_image": cover_image or "",
            "saved_at": saved_at,
            "device_id": device_id,
        }

        # 可选：保存完整详情（用于 Profile 详情展示与编辑）
        if context is not None:
            itin_data["context_json"] = json.dumps(
                context.model_dump(), ensure_ascii=False
            )
        if generated is not None:
            itin_data["generated_json"] = json.dumps(
                generated.model_dump(), ensure_ascii=False
            )
        await self.redis.hset(itin_key, mapping=itin_data)
        await self.redis.expire(itin_key, PROFILE_TTL)

        # Add to user's itinerary list
        await self.redis.zadd(itin_list_key, {itinerary_id: ts})
        await self.redis.expire(itin_list_key, PROFILE_TTL)

        # Update saved count
        await self.increment_stat(device_id, "saved", 1)

        logger.info(
            "Saved itinerary %s for device %s***", itinerary_id, device_hash[:6]
        )

        return {
            "success": True,
            "message": "行程已保存",
            "itinerary_id": itinerary_id,
        }

    async def list_itineraries(self, device_id: str) -> list[dict]:
        """List saved itineraries for a device."""
        device_hash = _hash_device(device_id)
        itin_list_key = _KEY_ITINERARIES.format(device_hash)

        # Get itinerary IDs sorted by saved_at (newest first)
        itin_ids = await self.redis.zrevrange(itin_list_key, 0, -1)
        if not itin_ids:
            return []

        itineraries = []
        for itin_id in itin_ids:
            itin_key = _KEY_ITINERARY.format(itin_id)
            data = await self.redis.hgetall(itin_key)
            if data:
                data["stops"] = int(data.get("stops", 0))
                data["days"] = int(data.get("days", 0))

                # 列表接口只返回摘要，避免 payload 过大
                data.pop("context_json", None)
                data.pop("generated_json", None)
                data.pop("device_id", None)
                itineraries.append(data)

        return itineraries

    async def get_itinerary_detail(
        self, device_id: str, itinerary_id: str
    ) -> Optional[dict]:
        """Get a single saved itinerary with optional generated/context.

        Returns a dict compatible with SavedItineraryDetail (models/profile.py).
        """
        device_hash = _hash_device(device_id)
        itin_list_key = _KEY_ITINERARIES.format(device_hash)

        # Ensure the itinerary belongs to this device
        score = await self.redis.zscore(itin_list_key, itinerary_id)
        if score is None:
            return None

        itin_key = _KEY_ITINERARY.format(itinerary_id)
        data = await self.redis.hgetall(itin_key)
        if not data:
            return None

        data["stops"] = int(data.get("stops", 0))
        data["days"] = int(data.get("days", 0))

        context_json = data.pop("context_json", None)
        generated_json = data.pop("generated_json", None)
        data.pop("device_id", None)

        if context_json:
            try:
                data["context"] = json.loads(context_json)
            except Exception:
                data["context"] = None
        if generated_json:
            try:
                data["generated"] = json.loads(generated_json)
            except Exception:
                data["generated"] = None

        return data

    async def delete_itinerary(self, device_id: str, itinerary_id: str) -> dict:
        """Remove a saved itinerary."""
        device_hash = _hash_device(device_id)
        itin_list_key = _KEY_ITINERARIES.format(device_hash)

        # Remove from list
        removed = await self.redis.zrem(itin_list_key, itinerary_id)
        if removed:
            # Remove itinerary data
            itin_key = _KEY_ITINERARY.format(itinerary_id)
            await self.redis.delete(itin_key)
            # Decrement saved count
            await self.increment_stat(device_id, "saved", -1)
            logger.info(
                "Deleted itinerary %s for device %s***", itinerary_id, device_hash[:6]
            )
            return {"success": True, "message": "行程已删除"}

        return {"success": False, "message": "行程不存在"}


# Singleton
profile_service = ProfileService()

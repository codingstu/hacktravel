"""Watchlist / Price Alert service — Redis persistence for price monitoring alerts.

Redis keys:
- hkt:watchlist:alert:{alert_id}  → HASH (origin, destination, max_price, email, created_at, status)
- hkt:watchlist:alerts             → ZSET (alert_id scored by created_at timestamp)
- hkt:watchlist:email:{email_hash} → SET of alert_id (for email-based lookup)
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_KEY_ALERT = "hkt:watchlist:alert:{}"
_KEY_ALERTS = "hkt:watchlist:alerts"
_KEY_EMAIL_ALERTS = "hkt:watchlist:email:{}"

MAX_ALERTS_PER_EMAIL = 10


def _hash_email(email: str) -> str:
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:16]


class WatchlistService:
    """Price alert CRUD backed by Redis."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
        return self._redis

    async def create_alert(
        self,
        origin: str,
        destination: str,
        max_price: float,
        email: str,
    ) -> dict:
        """Create a new price alert."""
        email_hash = _hash_email(email)

        # Check per-email limit
        existing_count = await self.redis.scard(
            _KEY_EMAIL_ALERTS.format(email_hash)
        )
        if existing_count >= MAX_ALERTS_PER_EMAIL:
            return {
                "success": False,
                "alert_id": "",
                "message": f"每个邮箱最多创建 {MAX_ALERTS_PER_EMAIL} 条监控",
            }

        alert_id = f"alert-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        created_at = now.isoformat()
        ts = now.timestamp()

        alert_data = {
            "alert_id": alert_id,
            "origin": origin,
            "destination": destination,
            "max_price": str(max_price),
            "email": email,
            "created_at": created_at,
            "status": "monitoring",
        }

        pipe = self.redis.pipeline()
        pipe.hset(_KEY_ALERT.format(alert_id), mapping=alert_data)
        pipe.expire(_KEY_ALERT.format(alert_id), 90 * 86400)  # 90 days TTL
        pipe.zadd(_KEY_ALERTS, {alert_id: ts})
        pipe.sadd(_KEY_EMAIL_ALERTS.format(email_hash), alert_id)
        pipe.expire(_KEY_EMAIL_ALERTS.format(email_hash), 90 * 86400)
        await pipe.execute()

        logger.info("Created price alert %s: %s→%s ≤¥%s", alert_id, origin, destination, max_price)

        return {
            "success": True,
            "alert_id": alert_id,
            "message": f"已创建监控：{origin}→{destination}，目标底价 ¥{max_price}",
        }

    async def list_alerts_by_email(self, email: str) -> list[dict]:
        """List all alerts for an email."""
        email_hash = _hash_email(email)
        alert_ids = await self.redis.smembers(
            _KEY_EMAIL_ALERTS.format(email_hash)
        )
        if not alert_ids:
            return []

        alerts = []
        for aid in sorted(alert_ids):
            data = await self.redis.hgetall(_KEY_ALERT.format(aid))
            if data:
                data["max_price"] = float(data.get("max_price", 0))
                alerts.append(data)

        return alerts


watchlist_service = WatchlistService()

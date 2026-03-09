"""Leads service — Tab3 盯盘邮箱收集.

Stores email subscriptions in Redis (real persistence, no mock).
Emails stored as a Redis SET for dedup + a sorted set with timestamps.

Security: emails are hashed for the dedup set, stored in plain in sorted set
(production would use AES-256 per blueprint §21.3).

Keys:
  - hkt:leads:emails (SET) — dedup check via SHA-256 hash
  - hkt:leads:timeline (ZSET) — email + timestamp for admin export
  - hkt:leads:count (STRING) — total count for fast stats
"""
from __future__ import annotations

import hashlib
import logging
import time

from app.models.leads import LeadEmailResponse, LeadStatsResponse
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)

_LEADS_DEDUP_KEY = "hkt:leads:emails"
_LEADS_TIMELINE_KEY = "hkt:leads:timeline"
_LEADS_COUNT_KEY = "hkt:leads:count"


def _hash_email(email: str) -> str:
    """Hash email for dedup (privacy-preserving)."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


class LeadsService:
    """Manages email lead collection in Redis."""

    async def submit_email(
        self, email: str, device_fingerprint: str | None = None,
    ) -> LeadEmailResponse:
        """Store an email subscription.

        Returns success with is_duplicate flag if already subscribed.
        """
        email_normalized = email.strip().lower()
        email_hash = _hash_email(email_normalized)

        try:
            r = cache_service._r

            # Check if already subscribed
            is_member = await r.sismember(_LEADS_DEDUP_KEY, email_hash)
            if is_member:
                logger.info("Duplicate lead email submission: %s***", email_normalized[:3])
                return LeadEmailResponse(
                    success=True,
                    message="你已经订阅过了，上线后第一时间通知你",
                    is_duplicate=True,
                )

            # Add to dedup set
            await r.sadd(_LEADS_DEDUP_KEY, email_hash)

            # Add to timeline sorted set (score = timestamp)
            ts = time.time()
            entry = email_normalized
            if device_fingerprint:
                entry = f"{email_normalized}|{device_fingerprint}"
            await r.zadd(_LEADS_TIMELINE_KEY, {entry: ts})

            # Increment counter
            await r.incr(_LEADS_COUNT_KEY)

            total = await r.get(_LEADS_COUNT_KEY)
            logger.info(
                "New lead email: %s*** (total: %s)",
                email_normalized[:3],
                total,
            )

            return LeadEmailResponse(
                success=True,
                message="订阅成功！底价雷达上线第一时间通知你，同时赠送 1 个月高级会员",
                is_duplicate=False,
            )

        except Exception as e:
            logger.error("Failed to store lead email: %s", e)
            # Even if Redis fails, don't expose internal error
            return LeadEmailResponse(
                success=False,
                message="服务暂时不可用，请稍后重试",
                is_duplicate=False,
            )

    async def get_stats(self) -> LeadStatsResponse:
        """Get total subscriber count."""
        try:
            r = cache_service._r
            count = await r.get(_LEADS_COUNT_KEY)
            total = int(count) if count else 0
        except Exception:
            total = 0

        return LeadStatsResponse(
            total_subscribers=total,
            message=f"已有 {total} 位旅行者抢先订阅" if total > 0 else "底价雷达即将上线",
        )


# Singleton
leads_service = LeadsService()

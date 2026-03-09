"""Leads API — Tab3 盯盘邮箱收集.

POST /v1/leads       — 提交邮箱订阅
GET  /v1/leads/stats — 获取订阅统计
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from app.core.config import settings
from app.models.leads import LeadEmailRequest, LeadEmailResponse, LeadStatsResponse
from app.services.leads_service import leads_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/leads", tags=["leads"])


@router.post("", response_model=LeadEmailResponse)
async def submit_lead_email(body: LeadEmailRequest) -> LeadEmailResponse:
    """Submit email for watchlist early access.

    Deduplicates by email hash, stores in Redis.
    """
    if not settings.ENABLE_WATCHLIST_LEAD_CAPTURE:
        return LeadEmailResponse(
            success=False,
            message="邮箱收集功能暂未开放",
        )

    return await leads_service.submit_email(
        email=body.email,
        device_fingerprint=body.device_fingerprint,
    )


@router.get("/stats", response_model=LeadStatsResponse)
async def get_lead_stats() -> LeadStatsResponse:
    """Get lead subscription statistics."""
    return await leads_service.get_stats()

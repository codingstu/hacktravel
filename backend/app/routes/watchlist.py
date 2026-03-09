"""Watchlist / Price Alert routes.

POST /v1/watchlist/alerts      — create price alert
GET  /v1/watchlist/alerts      — list alerts by email
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.watchlist import (
    PriceAlertItem,
    PriceAlertListResponse,
    PriceAlertRequest,
    PriceAlertResponse,
)
from app.services.watchlist_service import watchlist_service

router = APIRouter(prefix="/v1/watchlist", tags=["watchlist"])


@router.post("/alerts", response_model=PriceAlertResponse)
async def create_price_alert(body: PriceAlertRequest) -> PriceAlertResponse:
    """创建价格监控提醒"""
    result = await watchlist_service.create_alert(
        origin=body.origin,
        destination=body.destination,
        max_price=body.max_price,
        email=body.email,
    )
    return PriceAlertResponse(**result)


@router.get("/alerts", response_model=PriceAlertListResponse)
async def list_price_alerts(
    email: str = Query(..., description="查询邮箱"),
) -> PriceAlertListResponse:
    """查询某邮箱下的所有价格监控"""
    alerts = await watchlist_service.list_alerts_by_email(email)
    items = [PriceAlertItem(**a) for a in alerts]
    return PriceAlertListResponse(alerts=items, total=len(items))

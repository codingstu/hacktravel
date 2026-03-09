"""Community routes API — Tab2 抄作业.

GET  /v1/community/routes          — 精选路线列表（分页、排序）
GET  /v1/community/routes/{id}     — 单条路线详情（含 legs + map）
POST /v1/community/routes/{id}/copy — "我也要抄" — 计数 +1，返回完整路线
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query, Request

from app.core.config import settings
from app.models.community import (
    CommunityRouteDetail,
    CommunityRoutesListResponse,
    CopyRouteResponse,
)
from app.services.community_service import community_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/community", tags=["community"])


@router.get("/routes", response_model=CommunityRoutesListResponse)
async def list_community_routes(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=50, description="每页条数"),
    destination: Optional[str] = Query(default=None, description="目的地筛选"),
    tag: Optional[str] = Query(default=None, description="标签筛选"),
) -> CommunityRoutesListResponse:
    """List community routes sorted by copy_count desc.

    All routes are real verified routes with actual coordinates,
    transport references, and budget estimates.
    """
    return await community_service.list_routes(
        page=page,
        page_size=page_size,
        destination=destination,
        tag=tag,
    )


@router.get("/routes/{route_id}", response_model=CommunityRouteDetail)
async def get_community_route(route_id: str) -> CommunityRouteDetail:
    """Get a single community route with full legs and map info."""
    route = await community_service.get_route(route_id)
    if not route:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.post("/routes/{route_id}/copy", response_model=CopyRouteResponse)
async def copy_community_route(route_id: str) -> CopyRouteResponse:
    """'我也要抄' — increment copy count + return full route for user editing."""
    result = await community_service.copy_route(route_id)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Route not found")
    return result

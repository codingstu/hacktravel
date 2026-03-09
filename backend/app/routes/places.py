"""Place detail routes — GET /v1/places/detail

Fetches place information from Wikipedia (descriptions, images)
and generates Google Maps links for navigation.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.place_service import fetch_place_detail

router = APIRouter(prefix="/v1/places", tags=["places"])


class PlaceDetailResponse(BaseModel):
    name: str
    description: str = ""
    image_url: Optional[str] = None
    wiki_url: Optional[str] = None
    map_url: Optional[str] = None


@router.get("/detail", response_model=PlaceDetailResponse)
async def get_place_detail(
    name: str = Query(..., min_length=1, max_length=200, description="地点名称"),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
) -> PlaceDetailResponse:
    """获取地点详情（Wikipedia 摘要 + 图片 + 地图链接）"""
    data = await fetch_place_detail(
        place_name=name,
        latitude=latitude,
        longitude=longitude,
    )
    return PlaceDetailResponse(**data)

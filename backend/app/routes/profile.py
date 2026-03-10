"""Profile routes — Tab4 用户中心.

GET    /v1/profile                — get profile by device_id
PUT    /v1/profile                — update profile
GET    /v1/profile/stats          — aggregated stats
GET    /v1/profile/preferences    — get preferences
PUT    /v1/profile/preferences    — update preferences
GET    /v1/profile/itineraries    — list saved itineraries
POST   /v1/profile/itineraries    — save an itinerary
DELETE /v1/profile/itineraries/:id — delete saved itinerary
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.profile import (
    DeleteItineraryResponse,
    SavedItinerariesResponse,
    SavedItinerary,
    SaveItineraryRequest,
    SaveItineraryResponse,
    UserPreferences,
    UserPreferencesRequest,
    UserPreferencesResponse,
    UserProfile,
    UserProfileResponse,
    UserProfileUpdateRequest,
    UserStats,
    UserStatsResponse,
)
from app.services.profile_service import profile_service

router = APIRouter(prefix="/v1/profile", tags=["profile"])


@router.get("", response_model=UserProfileResponse)
async def get_profile(
    device_id: str = Query(..., min_length=1, description="设备标识"),
) -> UserProfileResponse:
    """获取用户资料（不存在则自动创建）"""
    data, is_new = await profile_service.get_profile(device_id)
    return UserProfileResponse(
        profile=UserProfile(**data),
        is_new=is_new,
    )


@router.put("", response_model=UserProfileResponse)
async def update_profile(body: UserProfileUpdateRequest) -> UserProfileResponse:
    """更新用户资料"""
    data = await profile_service.update_profile(
        device_id=body.device_id,
        name=body.name,
        tagline=body.tagline,
        avatar_url=body.avatar_url,
        countries_visited=body.countries_visited,
    )
    return UserProfileResponse(
        profile=UserProfile(**data),
        is_new=False,
    )


@router.get("/stats", response_model=UserStatsResponse)
async def get_stats(
    device_id: str = Query(..., min_length=1, description="设备标识"),
) -> UserStatsResponse:
    """获取用户统计数据"""
    stats = await profile_service.get_stats(device_id)
    return UserStatsResponse(
        stats=UserStats(**stats),
        device_id=device_id,
    )


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences(
    device_id: str = Query(..., min_length=1, description="设备标识"),
) -> UserPreferencesResponse:
    """获取用户偏好设置"""
    prefs = await profile_service.get_preferences(device_id)
    return UserPreferencesResponse(
        success=True,
        preferences=UserPreferences(**prefs),
    )


@router.put("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(body: UserPreferencesRequest) -> UserPreferencesResponse:
    """更新用户偏好设置"""
    prefs = await profile_service.update_preferences(
        device_id=body.device_id,
        dark_mode=body.dark_mode,
        language=body.language,
        currency=body.currency,
    )
    return UserPreferencesResponse(
        success=True,
        preferences=UserPreferences(**prefs),
    )


@router.get("/itineraries", response_model=SavedItinerariesResponse)
async def list_itineraries(
    device_id: str = Query(..., min_length=1, description="设备标识"),
) -> SavedItinerariesResponse:
    """获取已保存行程列表"""
    items = await profile_service.list_itineraries(device_id)
    itineraries = [SavedItinerary(**item) for item in items]
    return SavedItinerariesResponse(
        itineraries=itineraries,
        total=len(itineraries),
    )


@router.post("/itineraries", response_model=SaveItineraryResponse)
async def save_itinerary(body: SaveItineraryRequest) -> SaveItineraryResponse:
    """保存行程到用户收藏"""
    result = await profile_service.save_itinerary(
        device_id=body.device_id,
        itinerary_id=body.itinerary_id,
        title=body.title,
        destination=body.destination,
        stops=body.stops,
        days=body.days,
        cover_image=body.cover_image,
    )
    return SaveItineraryResponse(**result)


@router.delete("/itineraries/{itinerary_id}", response_model=DeleteItineraryResponse)
async def delete_itinerary(
    itinerary_id: str,
    device_id: str = Query(..., min_length=1, description="设备标识"),
) -> DeleteItineraryResponse:
    """删除已保存行程"""
    result = await profile_service.delete_itinerary(device_id, itinerary_id)
    return DeleteItineraryResponse(**result)

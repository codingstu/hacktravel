"""Pydantic models for Profile API (Tab4 用户中心).

GET  /v1/profile          — get profile by device_id
PUT  /v1/profile          — update profile
GET  /v1/profile/stats    — aggregated stats
PUT  /v1/profile/preferences — update preferences
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class UserProfile(BaseModel):
    """用户资料"""
    device_id: str = Field(..., min_length=1, max_length=128, description="设备标识")
    name: str = Field(default="Traveler", max_length=100, description="用户昵称")
    tagline: str = Field(default="Travel Enthusiast", max_length=200, description="个人标签")
    avatar_url: Optional[str] = Field(default=None, description="头像 URL")
    countries_visited: int = Field(default=0, ge=0, description="到访国家数")

    @field_validator("device_id", "name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class UserProfileUpdateRequest(BaseModel):
    """PUT /v1/profile request body."""
    device_id: str = Field(..., min_length=1, max_length=128)
    name: Optional[str] = Field(default=None, max_length=100)
    tagline: Optional[str] = Field(default=None, max_length=200)
    avatar_url: Optional[str] = Field(default=None)
    countries_visited: Optional[int] = Field(default=None, ge=0)

    @field_validator("device_id")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class UserProfileResponse(BaseModel):
    """GET /v1/profile response."""
    profile: UserProfile
    is_new: bool = False


class UserStats(BaseModel):
    """用户统计数据"""
    trips: int = 0
    saved: int = 0
    reviews: int = 0


class UserStatsResponse(BaseModel):
    """GET /v1/profile/stats response."""
    stats: UserStats
    device_id: str


class SavedItinerary(BaseModel):
    """已保存行程"""
    itinerary_id: str
    title: str
    destination: str
    stops: int = 0
    days: int = 0
    cover_image: Optional[str] = None
    saved_at: str = ""


class SavedItinerariesResponse(BaseModel):
    """GET /v1/profile/itineraries response."""
    itineraries: list[SavedItinerary]
    total: int


class SaveItineraryRequest(BaseModel):
    """POST /v1/profile/itineraries request body."""
    device_id: str = Field(..., min_length=1, max_length=128)
    itinerary_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    destination: str = Field(..., min_length=1, max_length=200)
    stops: int = Field(default=0, ge=0)
    days: int = Field(default=0, ge=0)
    cover_image: Optional[str] = None


class SaveItineraryResponse(BaseModel):
    """POST /v1/profile/itineraries response."""
    success: bool = True
    message: str = "行程已保存"
    itinerary_id: str = ""


class DeleteItineraryResponse(BaseModel):
    """DELETE /v1/profile/itineraries/:id response."""
    success: bool = True
    message: str = "行程已删除"


class UserPreferences(BaseModel):
    """用户偏好设置"""
    dark_mode: bool = False
    language: str = "en"
    currency: str = "USD"


class UserPreferencesRequest(BaseModel):
    """PUT /v1/profile/preferences request body."""
    device_id: str = Field(..., min_length=1, max_length=128)
    dark_mode: Optional[bool] = None
    language: Optional[str] = Field(default=None, max_length=10)
    currency: Optional[str] = Field(default=None, max_length=10)


class UserPreferencesResponse(BaseModel):
    """PUT /v1/profile/preferences response."""
    success: bool = True
    preferences: UserPreferences

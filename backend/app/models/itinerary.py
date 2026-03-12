"""Pydantic models for itinerary API request and response.

Aligned with implementation-blueprint.md Section 3 API contracts.
"""
from __future__ import annotations

import enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums ────────────────────────────────────────────────


class Currency(str, enum.Enum):
    CNY = "CNY"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    TRY = "TRY"
    THB = "THB"
    KRW = "KRW"


class ActivityType(str, enum.Enum):
    FLIGHT = "flight"
    TRANSIT = "transit"
    FOOD = "food"
    ATTRACTION = "attraction"
    REST = "rest"
    SHOPPING = "shopping"


class TransportMode(str, enum.Enum):
    WALK = "walk"
    BUS = "bus"
    METRO = "metro"
    TAXI = "taxi"
    TRAIN = "train"
    FLIGHT = "flight"


class LLMProvider(str, enum.Enum):
    PRIMARY = "primary"
    SILICONFLOW = "siliconflow"
    NVIDIA = "nvidia"


class Continent(str, enum.Enum):
    ASIA = "Asia"
    EUROPE = "Europe"
    AFRICA = "Africa"
    NORTH_AMERICA = "NorthAmerica"
    SOUTH_AMERICA = "SouthAmerica"
    OCEANIA = "Oceania"


# ── Shared Sub-Models ────────────────────────────────────


class Money(BaseModel):
    amount: float = Field(..., ge=0, description="金额")
    currency: Currency = Field(default=Currency.CNY, description="币种")

    @field_validator("currency", mode="before")
    @classmethod
    def coerce_currency(cls, v):
        """Normalize unknown currency codes to CNY."""
        if isinstance(v, str):
            v_upper = v.upper().strip()
            # Common LLM aliases
            aliases = {"RMB": "CNY", "YUAN": "CNY", "DOLLAR": "USD", "EURO": "EUR", "YEN": "JPY", "LIRA": "TRY"}
            v_upper = aliases.get(v_upper, v_upper)
            try:
                return Currency(v_upper)
            except ValueError:
                return Currency.CNY
        return v


class Place(BaseModel):
    name: str = Field(..., min_length=1, description="地点名称")
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    address: Optional[str] = None


class Transport(BaseModel):
    mode: TransportMode
    reference: Optional[str] = Field(default=None, description="航班号/公交线路等")


# ── Request Models ───────────────────────────────────────


class ItineraryGenerateRequest(BaseModel):
    """POST /v1/itineraries/generate request body."""

    origin: str = Field(..., min_length=1, max_length=200, description="出发地")
    destination: str = Field(..., min_length=1, max_length=200, description="目的地")
    total_hours: int = Field(..., gt=0, le=720, description="总时长（小时）")
    budget: Money = Field(..., description="预算")
    tags: list[str] = Field(default_factory=list, max_length=10, description="偏好标签")
    locale: str = Field(default="zh-CN", pattern=r"^(zh-CN|en-US)$")
    timezone: str = Field(default="Asia/Shanghai", description="用户时区")
    app_version: Optional[str] = None
    continent: Optional[Continent] = Field(default=None, description="大洲筛选")
    sub_region: Optional[str] = Field(default=None, max_length=64, description="子区域筛选，如 EastAsia")
    idempotency_key: str = Field(..., min_length=8, max_length=64, description="幂等键")
    skip_preset: bool = Field(default=False, description="强制跳过预置路线，直接调用 AI")

    @field_validator("tags", mode="before")
    @classmethod
    def deduplicate_tags(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))  # preserve order, remove duplicates


# ── Response Models ──────────────────────────────────────


class ItineraryLeg(BaseModel):
    """Single leg/segment in the itinerary timeline."""

    index: int = Field(..., ge=0)
    start_time_local: str = Field(..., description="ISO 8601 本地时间")
    end_time_local: str = Field(..., description="ISO 8601 本地时间")
    activity_type: ActivityType
    place: Place
    transport: Optional[Transport] = None
    estimated_cost: Money
    tips: list[str] = Field(default_factory=list)

    @field_validator("tips", mode="before")
    @classmethod
    def coerce_tips(cls, v):
        if isinstance(v, str):
            return [v] if v else []
        return v if v else []


class ItinerarySummary(BaseModel):
    total_hours: int
    estimated_total_cost: Money


class MapInfo(BaseModel):
    google_maps_deeplink: str
    waypoints_count: int = Field(..., ge=0)


class SourceInfo(BaseModel):
    llm_provider: str
    model_name: str
    cache_hit: bool = False
    is_preset: bool = False


class PolicyInfo(BaseModel):
    is_user_generated: bool = True
    can_share: bool = True
    disclaimer: str = Field(default="", description="地区感知免责提示，前端优先展示此字段")


class ItineraryGenerateResponse(BaseModel):
    """POST /v1/itineraries/generate response body."""

    itinerary_id: str
    title: str
    summary: ItinerarySummary
    legs: list[ItineraryLeg]
    map: MapInfo
    source: SourceInfo
    policy: PolicyInfo = Field(default_factory=PolicyInfo)


# ── Error Models ─────────────────────────────────────────


class ErrorResponse(BaseModel):
    """Unified error envelope."""

    error_code: str = Field(..., description="HKT 前缀错误码")
    message: str
    request_id: Optional[str] = None
    retry_after: Optional[int] = Field(default=None, description="秒，仅 429 使用")

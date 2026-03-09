"""Pydantic models for Community Routes API (Tab2 抄作业).

GET /v1/community/routes — list
GET /v1/community/routes/:id — detail
POST /v1/community/routes/:id/copy — 我也要抄
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.itinerary import ItineraryLeg, ItinerarySummary, MapInfo, Money


# ── Response Models ──────────────────────────────────────


class CommunityRouteCard(BaseModel):
    """Community route card for list view."""

    id: str
    title: str
    destination: str
    total_hours: int
    budget: Money
    cover_image: Optional[str] = None
    copy_count: int = 0
    tags: list[str] = Field(default_factory=list)
    summary: ItinerarySummary


class CommunityRouteDetail(CommunityRouteCard):
    """Full community route with legs and map info."""

    legs: list[ItineraryLeg] = Field(default_factory=list)
    map: Optional[MapInfo] = None


class CommunityRoutesListResponse(BaseModel):
    """GET /v1/community/routes response."""

    routes: list[CommunityRouteCard]
    total: int
    page: int = 1
    page_size: int = 20


class CopyRouteResponse(BaseModel):
    """POST /v1/community/routes/:id/copy response."""

    success: bool = True
    copy_count: int
    route: CommunityRouteDetail

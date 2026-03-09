"""Tests for Community routes service and models (Tab2 抄作业)."""
from __future__ import annotations

import pytest
from app.models.community import (
    CommunityRouteCard,
    CommunityRouteDetail,
    CommunityRoutesListResponse,
    CopyRouteResponse,
)
from app.models.itinerary import Money, ItinerarySummary
from app.services.community_service import (
    _make_route_id,
    _preset_to_card,
    _preset_to_detail,
    _ROUTE_INDEX,
    _SEED_COPY_COUNTS,
)
from app.services.preset_routes import _PRESET_DATA


# ── Model tests ──────────────────────────────────────────


def test_community_route_card_model():
    card = CommunityRouteCard(
        id="test-1",
        title="Test Route",
        destination="冲绳",
        total_hours=48,
        budget=Money(amount=2800, currency="CNY"),
        copy_count=100,
        tags=["疯狂暴走"],
        summary=ItinerarySummary(
            total_hours=48,
            estimated_total_cost=Money(amount=2800, currency="CNY"),
        ),
    )
    assert card.id == "test-1"
    assert card.copy_count == 100
    assert card.destination == "冲绳"


def test_community_route_detail_model():
    detail = CommunityRouteDetail(
        id="test-1",
        title="Test Route",
        destination="冲绳",
        total_hours=48,
        budget=Money(amount=2800, currency="CNY"),
        copy_count=100,
        tags=["疯狂暴走"],
        summary=ItinerarySummary(
            total_hours=48,
            estimated_total_cost=Money(amount=2800, currency="CNY"),
        ),
        legs=[],
    )
    assert detail.legs == []
    assert detail.map is None


def test_copy_route_response_model():
    resp = CopyRouteResponse(
        success=True,
        copy_count=101,
        route=CommunityRouteDetail(
            id="test-1",
            title="Test Route",
            destination="冲绳",
            total_hours=48,
            budget=Money(amount=2800, currency="CNY"),
            copy_count=101,
            tags=[],
            summary=ItinerarySummary(
                total_hours=48,
                estimated_total_cost=Money(amount=2800, currency="CNY"),
            ),
        ),
    )
    assert resp.copy_count == 101


# ── Community service unit tests ─────────────────────────


def test_make_route_id():
    preset = {"destination": "冲绳", "total_hours": 48}
    assert _make_route_id(preset) == "community-冲绳-48h"


def test_make_route_id_all_presets():
    """Every preset should have a unique route ID."""
    ids = set()
    for p in _PRESET_DATA:
        rid = _make_route_id(p)
        assert rid not in ids, f"Duplicate route ID: {rid}"
        ids.add(rid)


def test_route_index_coverage():
    """Route index should contain all presets."""
    assert len(_ROUTE_INDEX) == len(_PRESET_DATA)
    for p in _PRESET_DATA:
        rid = _make_route_id(p)
        assert rid in _ROUTE_INDEX


def test_seed_copy_counts_coverage():
    """All presets should have seed copy counts."""
    for p in _PRESET_DATA:
        rid = _make_route_id(p)
        assert rid in _SEED_COPY_COUNTS, f"Missing seed count for {rid}"
        assert _SEED_COPY_COUNTS[rid] > 0


def test_preset_to_card_okinawa():
    """Convert 冲绳 preset to card."""
    okinawa = next(p for p in _PRESET_DATA if p["destination"] == "冲绳")
    card = _preset_to_card(okinawa, 328)
    assert card.destination == "冲绳"
    assert card.total_hours == 48
    assert card.copy_count == 328
    assert len(card.tags) > 0
    assert card.budget.amount == 2800


def test_preset_to_detail_has_legs():
    """Convert preset to detail should include legs and map."""
    okinawa = next(p for p in _PRESET_DATA if p["destination"] == "冲绳")
    detail = _preset_to_detail(okinawa, 328)
    assert len(detail.legs) > 0
    assert detail.map is not None
    assert detail.map.waypoints_count > 0
    assert detail.map.google_maps_deeplink != ""


def test_preset_to_detail_all_presets():
    """Every preset should convert to detail without error."""
    for p in _PRESET_DATA:
        rid = _make_route_id(p)
        detail = _preset_to_detail(p, 100)
        assert detail.id == rid
        assert len(detail.title) > 0
        assert len(detail.legs) > 0
        assert detail.summary.total_hours > 0
        assert detail.summary.estimated_total_cost.amount > 0


def test_list_response_model():
    resp = CommunityRoutesListResponse(
        routes=[],
        total=0,
        page=1,
        page_size=20,
    )
    assert resp.total == 0
    assert resp.page == 1


# ── Total presets check ──────────────────────────────────


def test_preset_data_at_least_16():
    """We should have at least 16 real preset routes."""
    assert len(_PRESET_DATA) >= 16


def test_all_presets_have_real_coordinates():
    """All preset legs must have real lat/lng coordinates."""
    for p in _PRESET_DATA:
        for leg in p.get("legs", []):
            place = leg.get("place", {})
            assert place.get("latitude") is not None, (
                f"Missing latitude in {p['destination']} leg {leg.get('index')}"
            )
            assert place.get("longitude") is not None, (
                f"Missing longitude in {p['destination']} leg {leg.get('index')}"
            )
            # Verify coordinates are reasonable (not 0,0)
            assert abs(place["latitude"]) > 0.1
            assert abs(place["longitude"]) > 0.1

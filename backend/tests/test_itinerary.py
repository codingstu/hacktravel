"""Smoke tests for the itinerary generation API and utilities."""
from __future__ import annotations

import pytest
from app.models.itinerary import (
    ItineraryGenerateRequest,
    ItineraryLeg,
    Money,
    Currency,
    Place,
)
from app.utils.google_maps import build_google_maps_url, build_google_maps_urls
from app.services.llm_gateway import extract_json
from app.services.cache_service import CacheService
from app.services.preset_routes import (
    find_preset,
    get_all_preset_destinations,
    get_featured_sub_regions,
    get_preset_count,
    get_region_metadata,
    _normalize_dest,
)


# ── Model validation tests ───────────────────────────────


def test_request_model_valid():
    req = ItineraryGenerateRequest(
        origin="槟城",
        destination="冲绳",
        total_hours=48,
        budget=Money(amount=3000, currency=Currency.CNY),
        tags=["疯狂暴走", "极限吃货", "极限吃货"],  # duplicate
        idempotency_key="test12345678",
    )
    assert req.total_hours == 48
    assert len(req.tags) == 2  # deduplicated


def test_request_model_rejects_empty_destination():
    with pytest.raises(Exception):
        ItineraryGenerateRequest(
            origin="北京",
            destination="",
            total_hours=24,
            budget=Money(amount=500, currency=Currency.CNY),
            idempotency_key="test12345678",
        )


def test_leg_model_valid():
    leg = ItineraryLeg(
        index=0,
        start_time_local="2026-03-10T08:00:00",
        end_time_local="2026-03-10T09:00:00",
        activity_type="food",
        place=Place(name="Phở Hòa Pasteur", latitude=10.7769, longitude=106.6991),
        estimated_cost=Money(amount=15, currency=Currency.CNY),
        tips=["当地人最爱的粉店"],
    )
    assert leg.place.name == "Phở Hòa Pasteur"


# ── Google Maps URL tests ────────────────────────────────


def test_google_maps_url_basic():
    places = [
        Place(name="Airport", latitude=10.82, longitude=106.65),
        Place(name="Restaurant", latitude=10.78, longitude=106.70),
        Place(name="Hotel", latitude=10.77, longitude=106.69),
    ]
    url = build_google_maps_url(places)
    assert "origin=10.82,106.65" in url
    assert "destination=10.77,106.69" in url
    assert "waypoints=10.78,106.7" in url
    assert "travelmode=transit" in url


def test_google_maps_url_empty():
    assert build_google_maps_url([]) == ""
    assert build_google_maps_url([Place(name="A")]) == ""


def test_google_maps_urls_split():
    places = [Place(name=f"P{i}", latitude=i, longitude=i) for i in range(25)]
    urls = build_google_maps_urls(places)
    assert len(urls) >= 2  # should split into multiple segments


# ── JSON extraction tests ────────────────────────────────


def test_extract_json_direct():
    raw = '{"title": "test", "legs": []}'
    result = extract_json(raw)
    assert result["title"] == "test"


def test_extract_json_code_block():
    raw = 'Here is the plan:\n```json\n{"title": "test"}\n```\nDone.'
    result = extract_json(raw)
    assert result["title"] == "test"


def test_extract_json_brace_fallback():
    raw = 'Some text before {"title": "test"} some text after'
    result = extract_json(raw)
    assert result["title"] == "test"


def test_extract_json_fails():
    with pytest.raises(ValueError):
        extract_json("no json here at all")


# ── Cache service hash tests ────────────────────────────


def test_query_hash_deterministic():
    h1 = CacheService.build_query_hash("冲绳", 48, 3000, "CNY", ["暴走"])
    h2 = CacheService.build_query_hash("冲绳", 48, 3000, "CNY", ["暴走"])
    assert h1 == h2


def test_query_hash_budget_rounding():
    """Budgets within ±25 of a 50-unit boundary should hash the same."""
    h1 = CacheService.build_query_hash("冲绳", 48, 2990, "CNY", [])
    h2 = CacheService.build_query_hash("冲绳", 48, 3010, "CNY", [])
    assert h1 == h2


def test_query_hash_different_destinations():
    h1 = CacheService.build_query_hash("冲绳", 48, 3000, "CNY", [])
    h2 = CacheService.build_query_hash("曼谷", 48, 3000, "CNY", [])
    assert h1 != h2


# ── Preset routes tests ──────────────────────────────────


def test_preset_exact_match_okinawa():
    """Exact destination + hours should return a preset."""
    result = find_preset("冲绳", 48, 3000, "CNY", ["疯狂暴走"])
    assert result is not None
    assert result.source.is_preset is True
    assert result.source.llm_provider == "preset"
    assert len(result.legs) > 0


def test_preset_exact_match_bangkok():
    result = find_preset("曼谷", 24, 200, "CNY", ["极限吃货"])
    assert result is not None
    assert "曼谷" in result.title
    assert result.source.is_preset is True


def test_preset_alias_match():
    """English alias should resolve to canonical Chinese name."""
    result = find_preset("okinawa", 48, 3000, "CNY")
    assert result is not None
    assert result.source.is_preset is True


def test_preset_alias_saigon():
    result = find_preset("saigon", 48, 350, "CNY")
    assert result is not None


def test_preset_no_match_unknown_city():
    """Unknown destination should return None."""
    result = find_preset("北极", 48, 3000, "CNY")
    assert result is None


def test_preset_hours_tolerance():
    """36H query should still match 48H okinawa preset (within 50%)."""
    result = find_preset("冲绳", 36, 3000, "CNY")
    assert result is not None


def test_preset_hours_too_far():
    """12H query should NOT match 48H preset (>50% off)."""
    result = find_preset("冲绳", 12, 3000, "CNY")
    assert result is None


def test_preset_response_has_maps():
    result = find_preset("东京", 48, 3500, "CNY")
    assert result is not None
    assert result.map.google_maps_deeplink != ""
    assert result.map.waypoints_count > 0


def test_preset_all_destinations():
    dests = get_all_preset_destinations()
    assert len(dests) >= 10  # we have at least 10 destinations


def test_preset_count():
    assert get_preset_count() >= 15


def test_normalize_dest_case_insensitive():
    assert _normalize_dest("Bangkok") == "曼谷"
    assert _normalize_dest("OKINAWA") == "冲绳"
    assert _normalize_dest("冲绳") == "冲绳"  # already canonical


def test_preset_budget_hard_reject():
    """¥100 vs 新加坡 ¥1500 preset — too far off, must return None (was buggy before)."""
    result = find_preset("新加坡", 48, 100, "CNY")
    assert result is None, "Budget ratio 0.93 should hard-reject the preset"


def test_preset_budget_within_tolerance():
    """¥1200 vs 新加坡 ¥1500 preset — ratio 0.2, within ±60%, should match."""
    result = find_preset("新加坡", 48, 1200, "CNY")
    assert result is not None
    assert result.source.is_preset is True


def test_preset_respects_continent_filter():
    result = find_preset("伦敦", 24, 2200, "CNY", continent="Europe", sub_region="UK")
    assert result is not None
    assert "伦敦" in result.title


def test_preset_continent_filter_graceful_fallback():
    result = find_preset("伦敦", 24, 2200, "CNY", continent="Asia")
    assert result is not None
    assert result.source.is_preset is True


def test_region_metadata_contains_six_continents():
    metadata = get_region_metadata()
    keys = {item["key"] for item in metadata}
    assert keys == {"Asia", "Europe", "Africa", "NorthAmerica", "SouthAmerica", "Oceania"}


def test_featured_sub_regions_cover_priority_regions():
    featured = get_featured_sub_regions()
    keys = {item["key"] for item in featured}
    assert {"EastAsia", "SoutheastAsia", "UK", "LatinAmerica", "NorthAfrica", "SubSaharanAfrica"}.issubset(keys)


def test_priority_region_density_targets():
    assert get_preset_count(continent="Asia", sub_region="EastAsia") >= 6
    assert get_preset_count(continent="Asia", sub_region="SoutheastAsia") >= 6
    assert get_preset_count(continent="Europe", sub_region="UK") >= 4
    assert get_preset_count(continent="SouthAmerica", sub_region="LatinAmerica") >= 6
    assert get_preset_count(continent="Africa") >= 6

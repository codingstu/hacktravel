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

"""Tests for saved itinerary detail storage/retrieval.

These tests focus on ProfileService behavior without requiring a real Redis.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.models.itinerary import (
    Currency,
    ItineraryGenerateResponse,
    ItineraryLeg,
    ItinerarySummary,
    MapInfo,
    Money,
    Place,
    SourceInfo,
)
from app.models.profile import SavedItineraryContext
from app.services.profile_service import ProfileService


class FakeRedis:
    def __init__(self) -> None:
        self._hashes: dict[str, dict[str, str]] = {}
        self._zsets: dict[str, dict[str, float]] = {}

    async def exists(self, key: str) -> int:
        return int(key in self._hashes or key in self._zsets)

    async def expire(self, key: str, ttl: int) -> bool:
        return True

    async def hset(self, key: str, *args: Any, mapping: dict[str, str] | None = None) -> int:
        if key not in self._hashes:
            self._hashes[key] = {}
        if mapping is not None:
            self._hashes[key].update({k: str(v) for k, v in mapping.items()})
            return len(mapping)
        if len(args) == 2:
            field, value = args
            self._hashes[key][str(field)] = str(value)
            return 1
        raise TypeError("Unsupported hset signature")

    async def hgetall(self, key: str) -> dict[str, str]:
        return dict(self._hashes.get(key, {}))

    async def hincrby(self, key: str, field: str, amount: int) -> int:
        if key not in self._hashes:
            self._hashes[key] = {}
        current = int(self._hashes[key].get(field, "0"))
        current += int(amount)
        self._hashes[key][field] = str(current)
        return current

    async def zcard(self, key: str) -> int:
        return len(self._zsets.get(key, {}))

    async def zscore(self, key: str, member: str) -> float | None:
        return self._zsets.get(key, {}).get(member)

    async def zadd(self, key: str, mapping: dict[str, float]) -> int:
        if key not in self._zsets:
            self._zsets[key] = {}
        added = 0
        for member, score in mapping.items():
            if member not in self._zsets[key]:
                added += 1
            self._zsets[key][member] = float(score)
        return added

    async def zrevrange(self, key: str, start: int, stop: int) -> list[str]:
        items = list(self._zsets.get(key, {}).items())
        items.sort(key=lambda kv: kv[1], reverse=True)
        members = [m for m, _ in items]
        if stop == -1:
            return members[start:]
        return members[start : stop + 1]

    async def zrem(self, key: str, member: str) -> int:
        if key not in self._zsets or member not in self._zsets[key]:
            return 0
        del self._zsets[key][member]
        return 1


def _make_generated(itinerary_id: str) -> ItineraryGenerateResponse:
    legs = [
        ItineraryLeg(
            index=0,
            start_time_local="2026-03-10T08:00:00",
            end_time_local="2026-03-10T09:00:00",
            activity_type="food",
            place=Place(name="Sushi Dai"),
            estimated_cost=Money(amount=80, currency=Currency.JPY),
        ),
        ItineraryLeg(
            index=1,
            start_time_local="2026-03-10T10:00:00",
            end_time_local="2026-03-10T11:00:00",
            activity_type="attraction",
            place=Place(name="Tokyo Tower"),
            estimated_cost=Money(amount=20, currency=Currency.JPY),
        ),
    ]
    return ItineraryGenerateResponse(
        itinerary_id=itinerary_id,
        title="Shanghai → Tokyo",
        summary=ItinerarySummary(
            total_hours=48,
            estimated_total_cost=Money(amount=1000, currency=Currency.CNY),
        ),
        legs=legs,
        map=MapInfo(google_maps_deeplink="https://maps.google.com/?q=tokyo", waypoints_count=2),
        source=SourceInfo(llm_provider="test", model_name="test", cache_hit=True, is_preset=False),
    )


def test_profile_saved_itinerary_detail_roundtrip():
    async def _run() -> None:
        service = ProfileService()
        service._redis = FakeRedis()  # type: ignore[attr-defined]

        device_id = "dev_test_1"
        itinerary_id = "itin_test_1"

        context = SavedItineraryContext(
            origin="上海",
            destination="东京",
            total_hours=48,
            budget=Money(amount=3000, currency=Currency.CNY),
            tags=["疯狂暴走"],
            continent="Asia",
            sub_region="Japan",
        )
        generated = _make_generated(itinerary_id)

        saved = await service.save_itinerary(
            device_id=device_id,
            itinerary_id=itinerary_id,
            title="Shanghai → Tokyo",
            destination="东京",
            stops=len(generated.legs),
            days=2,
            cover_image="https://example.com/cover.jpg",
            context=context,
            generated=generated,
        )
        assert saved["success"] is True

        detail = await service.get_itinerary_detail(device_id, itinerary_id)
        assert detail is not None
        assert detail["itinerary_id"] == itinerary_id
        assert detail["context"]["origin"] == "上海"
        assert detail["generated"]["itinerary_id"] == itinerary_id
        assert "context_json" not in detail
        assert "generated_json" not in detail

        lst = await service.list_itineraries(device_id)
        assert len(lst) == 1
        assert lst[0]["itinerary_id"] == itinerary_id
        assert "context" not in lst[0]
        assert "generated" not in lst[0]

        other_device_detail = await service.get_itinerary_detail("dev_other", itinerary_id)
        assert other_device_detail is None

    asyncio.run(_run())

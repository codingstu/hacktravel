"""Tests for place_service and watchlist models / service."""
from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.models.watchlist import (
    PriceAlertRequest,
    PriceAlertResponse,
    PriceAlertItem,
    PriceAlertListResponse,
    ScanStatusResponse,
)
from app.services.place_service import fetch_place_detail


# ── Watchlist Model validation tests ─────────────────────


def test_price_alert_request_valid():
    req = PriceAlertRequest(
        origin="上海",
        destination="东京",
        max_price=2000,
        email="test@example.com",
    )
    assert req.origin == "上海"
    assert req.destination == "东京"
    assert req.max_price == 2000
    assert req.email == "test@example.com"


def test_price_alert_request_strips_whitespace():
    req = PriceAlertRequest(
        origin="  上海  ",
        destination="  东京  ",
        max_price=2000,
        email="  test@example.com  ",
    )
    assert req.origin == "上海"
    assert req.destination == "东京"
    assert req.email == "test@example.com"


def test_price_alert_request_rejects_empty_origin():
    with pytest.raises(Exception):
        PriceAlertRequest(
            origin="",
            destination="东京",
            max_price=2000,
            email="test@example.com",
        )


def test_price_alert_request_rejects_empty_destination():
    with pytest.raises(Exception):
        PriceAlertRequest(
            origin="上海",
            destination="",
            max_price=2000,
            email="test@example.com",
        )


def test_price_alert_request_rejects_zero_price():
    with pytest.raises(Exception):
        PriceAlertRequest(
            origin="上海",
            destination="东京",
            max_price=0,
            email="test@example.com",
        )


def test_price_alert_request_rejects_negative_price():
    with pytest.raises(Exception):
        PriceAlertRequest(
            origin="上海",
            destination="东京",
            max_price=-100,
            email="test@example.com",
        )


def test_price_alert_request_rejects_invalid_email():
    with pytest.raises(Exception):
        PriceAlertRequest(
            origin="上海",
            destination="东京",
            max_price=2000,
            email="not-an-email",
        )


def test_price_alert_response_model():
    resp = PriceAlertResponse(
        success=True,
        alert_id="test-id-123",
        message="创建成功",
    )
    assert resp.success is True
    assert resp.alert_id == "test-id-123"


def test_price_alert_item_model():
    item = PriceAlertItem(
        alert_id="id1",
        origin="上海",
        destination="东京",
        max_price=2000,
        email="test@example.com",
        created_at="2026-03-10T10:00:00",
        status="active",
    )
    assert item.alert_id == "id1"
    assert item.status == "active"


def test_price_alert_list_response():
    resp = PriceAlertListResponse(
        alerts=[
            PriceAlertItem(
                alert_id="id1",
                origin="上海",
                destination="东京",
                max_price=2000,
                email="test@example.com",
                created_at="2026-03-10T10:00:00",
                status="active",
            ),
        ],
        total=1,
    )
    assert resp.total == 1
    assert len(resp.alerts) == 1


def test_scan_status_response_scanning():
    resp = ScanStatusResponse(
        enabled=True,
        active_alerts=5,
        routes_scanned=250,
        last_scan_at="2026-03-13T10:00:00Z",
        status="scanning",
    )
    assert resp.enabled is True
    assert resp.status == "scanning"
    assert resp.routes_scanned == 250


def test_scan_status_response_offline():
    resp = ScanStatusResponse(
        enabled=False,
        active_alerts=0,
        routes_scanned=0,
        last_scan_at=None,
        status="offline",
    )
    assert resp.enabled is False
    assert resp.status == "offline"
    assert resp.last_scan_at is None


# ── Place service tests ──────────────────────────────────


def test_fetch_place_detail_wikipedia_success():
    """Mock Wikipedia API to return a valid summary."""
    async def _run():
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "type": "standard",
            "title": "东京铁塔",
            "extract": "东京铁塔是位于日本东京的一座电视塔。",
            "thumbnail": {"source": "https://upload.wikimedia.org/test.jpg"},
            "titles": {"canonical": "東京タワー"},
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.place_service.httpx.AsyncClient", return_value=mock_client):
            result = await fetch_place_detail("东京铁塔", 35.6586, 139.7454)

        assert result["name"] == "东京铁塔"
        assert "电视塔" in result["description"]
        assert result["image_url"] == "https://upload.wikimedia.org/test.jpg"
        assert "wikipedia" in result["wiki_url"]
        assert "google.com/maps" in result["map_url"]
    asyncio.run(_run())


def test_fetch_place_detail_no_wiki():
    """When Wikipedia returns 404, should still return basic info."""
    async def _run():
        mock_response_404 = MagicMock()
        mock_response_404.status_code = 404

        mock_search_response = MagicMock()
        mock_search_response.status_code = 200
        mock_search_response.json.return_value = {"pages": []}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[mock_response_404, mock_search_response])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.place_service.httpx.AsyncClient", return_value=mock_client):
            result = await fetch_place_detail("未知地点XYZ", 0, 0)

        assert result["name"] == "未知地点XYZ"
        assert result["description"] == ""
        assert result["image_url"] is None
    asyncio.run(_run())


def test_fetch_place_detail_generates_map_url():
    """Should generate Google Maps URL when lat/lng provided."""
    async def _run():
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "title": "TestPlace",
            "extract": "Test description",
            "content_urls": {"mobile": {"page": "https://zh.m.wikipedia.org/wiki/Test"}},
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.place_service.httpx.AsyncClient", return_value=mock_client):
            result = await fetch_place_detail("TestPlace", 35.6, 139.7)

        assert "35.6" in result["map_url"]
        assert "139.7" in result["map_url"]
    asyncio.run(_run())

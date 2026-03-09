"""Tests for Leads service and models (Tab3 盯盘邮箱收集)."""
from __future__ import annotations

import pytest
from app.models.leads import LeadEmailRequest, LeadEmailResponse, LeadStatsResponse


# ── Model validation tests ───────────────────────────────


def test_lead_email_request_valid():
    req = LeadEmailRequest(email="test@example.com")
    assert req.email == "test@example.com"


def test_lead_email_request_with_fingerprint():
    req = LeadEmailRequest(
        email="test@example.com",
        device_fingerprint="abc123xyz",
    )
    assert req.device_fingerprint == "abc123xyz"


def test_lead_email_request_normalizes():
    req = LeadEmailRequest(email="  TEST@Example.COM  ")
    assert req.email == "test@example.com"


def test_lead_email_request_rejects_invalid():
    with pytest.raises(Exception):
        LeadEmailRequest(email="not-an-email")


def test_lead_email_request_rejects_empty():
    with pytest.raises(Exception):
        LeadEmailRequest(email="")


def test_lead_email_request_rejects_no_domain():
    with pytest.raises(Exception):
        LeadEmailRequest(email="user@")


def test_lead_email_response_default():
    resp = LeadEmailResponse()
    assert resp.success is True
    assert resp.message == "订阅成功"
    assert resp.is_duplicate is False


def test_lead_email_response_duplicate():
    resp = LeadEmailResponse(
        success=True,
        message="你已经订阅过了",
        is_duplicate=True,
    )
    assert resp.is_duplicate is True


def test_lead_stats_response():
    stats = LeadStatsResponse(total_subscribers=42)
    assert stats.total_subscribers == 42


def test_lead_stats_response_default():
    stats = LeadStatsResponse(total_subscribers=0)
    assert stats.message == "底价雷达即将上线"


# ── Leads service unit tests (hashing) ────────────────────


def test_email_hash_deterministic():
    from app.services.leads_service import _hash_email
    h1 = _hash_email("test@example.com")
    h2 = _hash_email("test@example.com")
    assert h1 == h2


def test_email_hash_case_insensitive():
    from app.services.leads_service import _hash_email
    h1 = _hash_email("test@example.com")
    h2 = _hash_email("TEST@EXAMPLE.COM")
    assert h1 == h2


def test_email_hash_different():
    from app.services.leads_service import _hash_email
    h1 = _hash_email("a@example.com")
    h2 = _hash_email("b@example.com")
    assert h1 != h2

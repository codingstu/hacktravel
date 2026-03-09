"""Pydantic models for Leads API (Tab3 盯盘 — 邮箱收集).

POST /v1/leads — submit email
GET /v1/leads/stats — submission stats
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LeadEmailRequest(BaseModel):
    """POST /v1/leads request body."""

    email: str = Field(..., min_length=5, max_length=320, description="邮箱地址")
    device_fingerprint: Optional[str] = Field(
        default=None, max_length=128, description="设备指纹（可选）"
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("邮箱格式不正确")
        return v


class LeadEmailResponse(BaseModel):
    """POST /v1/leads response."""

    success: bool = True
    message: str = "订阅成功"
    is_duplicate: bool = False


class LeadStatsResponse(BaseModel):
    """GET /v1/leads/stats response."""

    total_subscribers: int
    message: str = "底价雷达即将上线"

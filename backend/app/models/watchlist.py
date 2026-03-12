"""Watchlist / Price Alert models."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PriceAlertRequest(BaseModel):
    """创建价格监控请求"""
    origin: str = Field(..., min_length=1, max_length=200, description="出发城市")
    destination: str = Field(..., min_length=1, max_length=200, description="目的城市")
    max_price: float = Field(..., gt=0, description="目标底价（CNY）")
    email: str = Field(..., description="通知邮箱")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("邮箱格式不正确")
        return v

    @field_validator("origin", "destination")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class PriceAlertResponse(BaseModel):
    success: bool
    alert_id: str
    message: str


class PriceAlertItem(BaseModel):
    alert_id: str
    origin: str
    destination: str
    max_price: float
    email: str
    created_at: str
    status: str = "monitoring"  # monitoring | triggered | expired


class PriceAlertListResponse(BaseModel):
    alerts: list[PriceAlertItem]
    total: int


class ScanStatusResponse(BaseModel):
    """价格扫描系统状态"""
    enabled: bool = Field(description="扫描功能是否启用")
    active_alerts: int = Field(default=0, description="当前活跃监控数")
    routes_scanned: int = Field(default=0, description="已扫描航线数")
    last_scan_at: Optional[str] = Field(default=None, description="最后扫描时间 ISO")
    status: str = Field(default="idle", description="idle | scanning | paused | offline")

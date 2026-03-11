"""Core configuration and settings."""
from __future__ import annotations

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "HackTravel"
    APP_ENV: str = Field(default="local", description="local | staging | production")
    DEBUG: bool = True
    API_VERSION: int = 1

    # ── Feature Flags ────────────────────────────────────
    ENABLE_AUTH: bool = False
    ENABLE_COMMUNITY: bool = True
    ENABLE_SHARE_POSTER: bool = True
    ENABLE_WATCHLIST_LEAD_CAPTURE: bool = True
    ENABLE_ADMIN_REVIEW: bool = False

    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hacktravel"

    # ── Redis ────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_HOT: int = 604800  # 7 days for hot destinations
    CACHE_TTL_COLD: int = 259200  # 3 days for cold destinations

    # ── LLM Providers ────────────────────────────────────
    # Primary: ShowQR Grok gateway — prefer grok-4.1-fast only (fast model)
    LLM_PRIMARY_BASE_URL: str = "https://grok.showqr.eu.cc/v1"
    LLM_PRIMARY_API_KEY: str = ""
    LLM_PRIMARY_MODEL: str = "grok-4.1-fast"
    LLM_PRIMARY_FALLBACK_MODELS: str = ""  # 移除 thinking 兜底，太慢
    LLM_PRIMARY_TIMEOUT: int = 15  # 15s: fast 模型不应该这么慢
    LLM_PRIMARY_REASONING_EFFORT: str = ""
    LLM_PRIMARY_MAX_COMPLETION_TOKENS: int = 0
    LLM_PRIMARY_MAX_LEGS: int = 6
    LLM_PRIMARY_MAX_TIPS_PER_LEG: int = 1

    # First backup: ShowQR OpenAI gateway — gpt-5.2 fallback
    LLM_BACKUP1_BASE_URL: str = "https://openai.showqr.eu.cc/v1"
    LLM_BACKUP1_API_KEY: str = ""
    LLM_BACKUP1_MODEL: str = "gpt-5.2"
    LLM_BACKUP1_FALLBACK_MODELS: str = ""
    LLM_BACKUP1_TIMEOUT: int = 15  # 15s

    # Second backup: SiliconFlow (保底 — reliable domestic provider)
    LLM_BACKUP2_BASE_URL: str = "https://api.siliconflow.cn/v1"
    LLM_BACKUP2_API_KEY: str = ""
    LLM_BACKUP2_MODEL: str = "Qwen/Qwen2.5-72B-Instruct"
    LLM_BACKUP2_FALLBACK_MODELS: str = ""  # 移除 DeepSeek 兜底，控制链路总时长
    LLM_BACKUP2_TIMEOUT: int = 18  # 18s: SiliconFlow 实际推理稍慢

    # 全链路硬上限：所有 provider 累计不超过此时间，超时返回 504
    # 3 providers × 最长 18s = 54s，设 50s 保留 5s 网络余量
    LLM_TOTAL_TIMEOUT: int = 50

    LLM_TEMPERATURE: float = 0.2

    # ── Rate Limiting ────────────────────────────────────
    RATE_LIMIT_ANONYMOUS: int = 200  # per hour (generous for dev; tighten in prod)
    RATE_LIMIT_AUTHENTICATED: int = 500  # per hour

    # ── Google Maps ──────────────────────────────────────
    GOOGLE_GEOCODING_API_KEY: str = ""
    GOOGLE_MAPS_WAYPOINT_LIMIT: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

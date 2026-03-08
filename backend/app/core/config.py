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
    LLM_PRIMARY_BASE_URL: str = "http://openai.showqr.eu.cc/v1"
    LLM_PRIMARY_API_KEY: str = ""
    LLM_PRIMARY_MODEL: str = "gpt-5.4"
    LLM_PRIMARY_TIMEOUT: int = 60  # seconds (read timeout for LLM generation)

    LLM_BACKUP1_BASE_URL: str = "https://api.siliconflow.cn/v1"
    LLM_BACKUP1_API_KEY: str = ""
    LLM_BACKUP1_MODEL: str = "deepseek-ai/DeepSeek-V3"
    LLM_BACKUP1_TIMEOUT: int = 90

    LLM_BACKUP2_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    LLM_BACKUP2_API_KEY: str = ""
    LLM_BACKUP2_MODEL: str = "meta/llama-3.1-70b-instruct"
    LLM_BACKUP2_TIMEOUT: int = 90

    LLM_TEMPERATURE: float = 0.3

    # ── Rate Limiting ────────────────────────────────────
    RATE_LIMIT_ANONYMOUS: int = 10  # per hour
    RATE_LIMIT_AUTHENTICATED: int = 50  # per hour

    # ── Google Maps ──────────────────────────────────────
    GOOGLE_GEOCODING_API_KEY: str = ""
    GOOGLE_MAPS_WAYPOINT_LIMIT: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

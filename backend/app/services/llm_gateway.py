"""LLM Gateway – multi-provider routing with automatic failover.

Provider chain: Codex 5.4 (primary) → SiliconFlow (backup1) → NVIDIA NIM (backup2).
Trigger: timeout / 5xx / connection error.
Final fallback: cached itinerary (handled by caller).

Aligned with blueprint Section 2.4 and Section 4.
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Provider definition ──────────────────────────────────


@dataclass
class LLMProviderConfig:
    name: str
    base_url: str
    api_key: str
    model: str
    timeout: int


def _build_provider_chain() -> list[LLMProviderConfig]:
    """Build ordered provider list from settings."""
    return [
        LLMProviderConfig(
            name="codex54",
            base_url=settings.LLM_PRIMARY_BASE_URL,
            api_key=settings.LLM_PRIMARY_API_KEY,
            model=settings.LLM_PRIMARY_MODEL,
            timeout=settings.LLM_PRIMARY_TIMEOUT,
        ),
        LLMProviderConfig(
            name="siliconflow",
            base_url=settings.LLM_BACKUP1_BASE_URL,
            api_key=settings.LLM_BACKUP1_API_KEY,
            model=settings.LLM_BACKUP1_MODEL,
            timeout=settings.LLM_BACKUP1_TIMEOUT,
        ),
        LLMProviderConfig(
            name="nvidia",
            base_url=settings.LLM_BACKUP2_BASE_URL,
            api_key=settings.LLM_BACKUP2_API_KEY,
            model=settings.LLM_BACKUP2_MODEL,
            timeout=settings.LLM_BACKUP2_TIMEOUT,
        ),
    ]


# ── Result envelope ──────────────────────────────────────


@dataclass
class LLMResult:
    """Wrapper for a successful LLM call."""

    provider_name: str
    model_name: str
    raw_text: str
    parsed_json: dict[str, Any] | None = None
    latency_ms: int = 0
    switch_count: int = 0  # how many providers were tried before success


# ── System & User prompt construction ────────────────────

SYSTEM_PROMPT = """\
你是一位经验丰富的特种兵旅行规划师。根据用户给出的出发地、目的地、时长和预算，规划一条极限省钱、时间紧凑的路线。

严格要求：
1. 输出格式为 JSON，不允许任何额外解释文本
2. 每个 leg 必须包含：地点名称(name)、经纬度(latitude/longitude)、起止时间(start_time_local/end_time_local，ISO 8601)、交通方式(transport)、预估花费(estimated_cost)
3. 花费必须标注币种，默认人民币 CNY
4. 时间必须连续，不允许出现未安排的空档
5. 总花费不得超过用户设定的预算上限
6. 优先推荐当地人去的平价餐厅和免费景点
7. activity_type 必须为以下之一: flight, transit, food, attraction, rest, shopping
8. transport.mode 必须为以下之一: walk, bus, metro, taxi, flight

输出 JSON 骨架（严格遵守，不要添加额外字段）:
```json
{
  "title": "string",
  "summary": {"total_hours": 0, "estimated_total_cost": {"amount": 0, "currency": "CNY"}},
  "legs": [
    {
      "index": 0,
      "start_time_local": "2026-01-01T08:00:00",
      "end_time_local": "2026-01-01T09:00:00",
      "activity_type": "transit",
      "place": {"name": "", "latitude": 0, "longitude": 0, "address": ""},
      "transport": {"mode": "bus", "reference": ""},
      "estimated_cost": {"amount": 0, "currency": "CNY"},
      "tips": [""]
    }
  ]
}
```\
"""


def build_user_prompt(
    origin: str,
    destination: str,
    total_hours: int,
    budget_amount: float,
    budget_currency: str,
    tags: list[str],
    locale: str,
    timezone: str,
) -> str:
    tag_text = "、".join(tags) if tags else "无特殊偏好"
    lang = "中文" if locale.startswith("zh") else "English"
    return (
        f"出发地：{origin}\n"
        f"目的地：{destination}\n"
        f"总时长：{total_hours} 小时\n"
        f"预算上限：{budget_amount} {budget_currency}\n"
        f"偏好标签：{tag_text}\n"
        f"时区：{timezone}\n"
        f"请用{lang}输出。\n"
        f"仅输出 JSON，不要任何其他文字。"
    )


# ── JSON extraction helpers ──────────────────────────────

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def extract_json(text: str) -> dict[str, Any]:
    """Try to parse JSON from model output.

    Strategy: json.loads directly → regex extract code block → raise.
    """
    # 1. Direct parse
    text_stripped = text.strip()
    try:
        return json.loads(text_stripped)
    except json.JSONDecodeError:
        pass

    # 2. Extract from ```json ... ``` block
    match = _JSON_BLOCK_RE.search(text_stripped)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 3. Try to find first { ... } block
    first_brace = text_stripped.find("{")
    last_brace = text_stripped.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(text_stripped[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Failed to extract JSON from LLM output (length={len(text)})")


# ── Core gateway ─────────────────────────────────────────


class LLMGateway:
    """Multi-provider LLM gateway with automatic failover."""

    def __init__(self) -> None:
        self.providers = _build_provider_chain()

    async def generate(
        self,
        origin: str,
        destination: str,
        total_hours: int,
        budget_amount: float,
        budget_currency: str,
        tags: list[str],
        locale: str,
        timezone: str,
    ) -> LLMResult:
        """Call LLM providers in order; raise on total failure."""
        user_prompt = build_user_prompt(
            origin=origin,
            destination=destination,
            total_hours=total_hours,
            budget_amount=budget_amount,
            budget_currency=budget_currency,
            tags=tags,
            locale=locale,
            timezone=timezone,
        )

        last_error: Exception | None = None

        for idx, provider in enumerate(self.providers):
            if not provider.api_key:
                logger.warning("Skipping provider %s – no API key configured", provider.name)
                continue

            try:
                result = await self._call_provider(provider, user_prompt)
                result.switch_count = idx
                return result
            except Exception as exc:
                last_error = exc
                logger.error(
                    "Provider %s failed: %s, switching to next",
                    provider.name,
                    str(exc)[:200],
                )

        raise RuntimeError(
            f"All LLM providers failed. Last error: {last_error}"
        )

    async def _call_provider(
        self, provider: LLMProviderConfig, user_prompt: str
    ) -> LLMResult:
        """Make a single OpenAI-compatible chat completion call."""
        url = f"{provider.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.model,
            "temperature": settings.LLM_TEMPERATURE,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "stop": ["```\n"],  # stop sequence to anchor output
        }

        start = time.monotonic()
        # Separate connect (10s) and read timeout (per-provider, for LLM generation)
        timeout_config = httpx.Timeout(
            connect=10.0,
            read=float(provider.timeout),
            write=10.0,
            pool=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            resp = await client.post(url, headers=headers, json=payload)

        latency_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code >= 500:
            raise httpx.HTTPStatusError(
                f"Server error {resp.status_code}",
                request=resp.request,
                response=resp,
            )
        resp.raise_for_status()

        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"]
        parsed = extract_json(raw_text)

        return LLMResult(
            provider_name=provider.name,
            model_name=provider.model,
            raw_text=raw_text,
            parsed_json=parsed,
            latency_ms=latency_ms,
        )


# Singleton
llm_gateway = LLMGateway()

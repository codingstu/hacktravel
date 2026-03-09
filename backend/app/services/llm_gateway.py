"""LLM Gateway – multi-provider routing with provider/model-level degradation.

Optimized degradation chain:
  1. OpenAI-compatible gateway: gpt-5.4 (short timeout, fail fast)
  2. NVIDIA NIM: Llama-3.1-70B-Instruct → Nemotron-4-340B-Instruct
  3. SiliconFlow: Qwen2.5-72B-Instruct → DeepSeek-V3 → DeepSeek-R1

Trigger: timeout / 5xx / connection error / JSON parse failure.
Final fallback: cached itinerary (handled by caller).
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
    reasoning_effort: str | None = None
    max_completion_tokens: int | None = None


def _split_models(value: str) -> list[str]:
    return [model.strip() for model in value.split(",") if model.strip()]



def _append_provider_models(
    chain: list[LLMProviderConfig],
    *,
    provider_name: str,
    base_url: str,
    api_key: str,
    primary_model: str,
    fallback_models: str,
    timeout: int,
    reasoning_effort: str | None = None,
    max_completion_tokens: int | None = None,
) -> None:
    models = [primary_model.strip(), *_split_models(fallback_models)]
    seen: set[str] = set()

    for index, model_name in enumerate(models):
        if not model_name or model_name in seen:
            continue
        seen.add(model_name)
        chain.append(
            LLMProviderConfig(
                name=provider_name if index == 0 else f"{provider_name}-{index + 1}",
                base_url=base_url,
                api_key=api_key,
                model=model_name,
                timeout=timeout,
                reasoning_effort=reasoning_effort,
                max_completion_tokens=max_completion_tokens,
            )
        )



def _build_provider_chain() -> list[LLMProviderConfig]:
    """Build ordered provider list with provider/model degradation.

    Strategy:
    1. OpenAI-compatible primary gateway only keeps the main model and fails fast
    2. NVIDIA NIM is the first external fallback, with fast/strong models in order
    3. SiliconFlow is the second external fallback, avoiding slow reasoning-first models first
    """
    chain: list[LLMProviderConfig] = []

    _append_provider_models(
        chain,
        provider_name="primary",
        base_url=settings.LLM_PRIMARY_BASE_URL,
        api_key=settings.LLM_PRIMARY_API_KEY,
        primary_model=settings.LLM_PRIMARY_MODEL,
        fallback_models=settings.LLM_PRIMARY_FALLBACK_MODELS,
        timeout=settings.LLM_PRIMARY_TIMEOUT,
        reasoning_effort=settings.LLM_PRIMARY_REASONING_EFFORT,
        max_completion_tokens=settings.LLM_PRIMARY_MAX_COMPLETION_TOKENS,
    )
    _append_provider_models(
        chain,
        provider_name="nvidia",
        base_url=settings.LLM_BACKUP1_BASE_URL,
        api_key=settings.LLM_BACKUP1_API_KEY,
        primary_model=settings.LLM_BACKUP1_MODEL,
        fallback_models=settings.LLM_BACKUP1_FALLBACK_MODELS,
        timeout=settings.LLM_BACKUP1_TIMEOUT,
    )
    _append_provider_models(
        chain,
        provider_name="siliconflow",
        base_url=settings.LLM_BACKUP2_BASE_URL,
        api_key=settings.LLM_BACKUP2_API_KEY,
        primary_model=settings.LLM_BACKUP2_MODEL,
        fallback_models=settings.LLM_BACKUP2_FALLBACK_MODELS,
        timeout=settings.LLM_BACKUP2_TIMEOUT,
    )

    model_names = [f"{p.name}:{p.model}" for p in chain]
    logger.info("LLM provider chain: %s", " → ".join(model_names))
    return chain


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
你是一位经验丰富的特种兵旅行规划师。

仅输出 JSON 对象，不允许任何解释文本或 Markdown。
字段只允许：title、summary、legs。
summary 只允许：total_hours、estimated_total_cost。
每个 leg 只允许：index、start_time_local、end_time_local、activity_type、place、transport、estimated_cost、tips。
activity_type 只能是：flight, transit, food, attraction, rest, shopping。
transport.mode 只能是：walk, bus, metro, taxi, train, flight。
place 必须包含：name、latitude、longitude、address。
estimated_cost 必须包含：amount、currency。
时间必须连续，总花费不得超过预算。
优先输出紧凑、可执行、省钱的路线，减少冗长描述。
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
        f"请为以下需求生成紧凑 itinerary JSON："
        f"出发地={origin}；"
        f"目的地={destination}；"
        f"总时长={total_hours}小时；"
        f"预算={budget_amount} {budget_currency}；"
        f"偏好={tag_text}；"
        f"时区={timezone}；"
        f"语言={lang}；"
        f"legs 控制在 4 到 {settings.LLM_PRIMARY_MAX_LEGS} 段；"
        f"每段 tips 最多 {settings.LLM_PRIMARY_MAX_TIPS_PER_LEG} 条短句；"
        f"字段严格匹配系统要求；"
        f"仅输出 JSON。"
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
        total = len(self.providers)
        skip_base_url: str | None = None  # if a gateway times out, skip rest on same gateway

        for idx, provider in enumerate(self.providers):
            if not provider.api_key:
                logger.warning(
                    "[%d/%d] Skipping %s (%s) – no API key",
                    idx + 1, total, provider.name, provider.model,
                )
                continue

            # Smart skip: if previous timeout was on same gateway, skip remaining same-gateway models
            if skip_base_url and provider.base_url == skip_base_url:
                logger.warning(
                    "[%d/%d] Skipping %s model=%s – same gateway timed out",
                    idx + 1, total, provider.name, provider.model,
                )
                continue

            logger.info(
                "[%d/%d] Trying %s model=%s timeout=%ds",
                idx + 1, total, provider.name, provider.model, provider.timeout,
            )
            try:
                result = await self._call_provider(provider, user_prompt)
                result.switch_count = idx
                logger.info(
                    "[%d/%d] Success via %s model=%s latency=%dms",
                    idx + 1, total, provider.name, provider.model, result.latency_ms,
                )
                return result
            except httpx.ReadTimeout:
                last_error = httpx.ReadTimeout(
                    f"ReadTimeout on {provider.name} model={provider.model}"
                )
                logger.error(
                    "[%d/%d] %s model=%s TIMEOUT after %ds – skipping same gateway",
                    idx + 1, total, provider.name, provider.model, provider.timeout,
                )
                skip_base_url = provider.base_url  # mark this gateway as timed-out
            except httpx.HTTPStatusError as exc:
                last_error = exc
                status = exc.response.status_code
                logger.error(
                    "[%d/%d] %s model=%s HTTP %d – trying next model",
                    idx + 1, total, provider.name, provider.model, status,
                )
                # Model-specific error (404/429/503): try next model on same gateway
                # Don't set skip_base_url — only timeout triggers gateway skip
            except Exception as exc:
                last_error = exc
                logger.error(
                    "[%d/%d] %s model=%s FAILED: %s – trying next",
                    idx + 1, total, provider.name, provider.model, str(exc)[:200],
                )

        raise RuntimeError(
            f"All {total} LLM providers failed. Last error: {last_error}"
        )

    async def _call_provider(
        self, provider: LLMProviderConfig, user_prompt: str
    ) -> LLMResult:
        """Make a single OpenAI-compatible chat completion call."""
        base_url = provider.base_url.rstrip("/")
        if base_url.endswith("/chat/completions"):
            url = base_url
        elif base_url.endswith("/v1"):
            url = f"{base_url}/chat/completions"
        else:
            url = f"{base_url}/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.model,
            "temperature": settings.LLM_TEMPERATURE,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        }
        if provider.reasoning_effort:
            payload["reasoning_effort"] = provider.reasoning_effort
        if provider.max_completion_tokens:
            payload["max_completion_tokens"] = provider.max_completion_tokens

        start = time.monotonic()
        # Separate connect (10s) and read timeout (per-provider, for LLM generation)
        timeout_config = httpx.Timeout(
            connect=10.0,
            read=float(provider.timeout),
            write=10.0,
            pool=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout_config, trust_env=False) as client:
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
        if isinstance(raw_text, list):
            raw_text = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in raw_text
            )
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

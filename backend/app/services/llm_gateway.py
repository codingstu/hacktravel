"""LLM Gateway – multi-provider routing with provider/model-level degradation.

Optimized degradation chain:
  1. ShowQR gateway (primary): gemini-3-flash (~13s) → gpt-5.2 (fallback)
  2. SiliconFlow (保底): Qwen2.5-72B-Instruct → DeepSeek-V3 → DeepSeek-R1
  3. NVIDIA NIM (last resort): z-ai/glm4.7

Smart skip: if a gateway is UNREACHABLE (ConnectTimeout/ConnectError), skip all
remaining models on that gateway. ReadTimeout does NOT trigger gateway skip
(other models on same gateway may respond faster).

Trigger: timeout / 5xx / connection error / JSON parse failure / gateway error.
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



def _derive_provider_name(base_url: str, fallback: str) -> str:
    """Derive a human-readable provider name from the base URL domain."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(base_url).hostname or ""
        if "nvidia" in domain:
            return "nvidia"
        elif "siliconflow" in domain:
            return "siliconflow"
        elif "openai" in domain or "showqr" in domain:
            return "openai"
        return fallback
    except Exception:
        return fallback


def _build_provider_chain() -> list[LLMProviderConfig]:
    """Build ordered provider list with provider/model degradation.

    Strategy:
    1. ShowQR primary: fast models (DeepSeek-V3.1, Qwen3, etc.)
    2. Backup1: SiliconFlow 保底 (Qwen, DeepSeek)
    3. Backup2: NVIDIA NIM (last resort)
    Provider names are auto-derived from the base URL domain.
    """
    chain: list[LLMProviderConfig] = []

    _append_provider_models(
        chain,
        provider_name=_derive_provider_name(settings.LLM_PRIMARY_BASE_URL, "primary"),
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
        provider_name=_derive_provider_name(settings.LLM_BACKUP1_BASE_URL, "backup1"),
        base_url=settings.LLM_BACKUP1_BASE_URL,
        api_key=settings.LLM_BACKUP1_API_KEY,
        primary_model=settings.LLM_BACKUP1_MODEL,
        fallback_models=settings.LLM_BACKUP1_FALLBACK_MODELS,
        timeout=settings.LLM_BACKUP1_TIMEOUT,
    )
    _append_provider_models(
        chain,
        provider_name=_derive_provider_name(settings.LLM_BACKUP2_BASE_URL, "backup2"),
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
You are a travel planner. Output ONLY a compact JSON object.
Fields: title(string), summary(object), legs(array).
summary: total_hours(int), estimated_total_cost(object with amount,currency).
Each leg: index, start_time_local, end_time_local, activity_type, place, transport, estimated_cost, tips.
activity_type: flight|transit|food|attraction|rest|shopping.
transport: object with mode(walk|bus|metro|taxi|train|flight).
place: name, latitude, longitude, address.
estimated_cost: amount, currency.
tips: array of strings, e.g. ["tip1","tip2"].
Be extremely concise. No explanations. Pure JSON only.
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
    tag_text = ",".join(tags) if tags else "none"
    lang = "Chinese" if locale.startswith("zh") else "English"
    return (
        f"Compact itinerary JSON: origin={origin}; dest={destination}; "
        f"{total_hours}h; budget={budget_amount}{budget_currency}; "
        f"prefs={tag_text}; tz={timezone}; lang={lang}; "
        f"4-{settings.LLM_PRIMARY_MAX_LEGS} legs; "
        f"{settings.LLM_PRIMARY_MAX_TIPS_PER_LEG} tip per leg; JSON only."
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
        skip_base_url: str | None = None  # if a gateway is UNREACHABLE, skip rest on same gateway

        for idx, provider in enumerate(self.providers):
            if not provider.api_key:
                logger.warning(
                    "[%d/%d] Skipping %s (%s) – no API key",
                    idx + 1, total, provider.name, provider.model,
                )
                continue

            # Smart skip: only on CONNECT failures (gateway unreachable), not read timeouts
            if skip_base_url and provider.base_url == skip_base_url:
                logger.warning(
                    "[%d/%d] Skipping %s model=%s – gateway unreachable",
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
            except httpx.ConnectTimeout:
                last_error = httpx.ConnectTimeout(
                    f"ConnectTimeout on {provider.name} model={provider.model}"
                )
                logger.error(
                    "[%d/%d] %s model=%s CONNECT TIMEOUT – skipping gateway",
                    idx + 1, total, provider.name, provider.model,
                )
                skip_base_url = provider.base_url  # gateway unreachable
            except httpx.ConnectError as exc:
                last_error = exc
                logger.error(
                    "[%d/%d] %s model=%s CONNECT ERROR: %s – skipping gateway",
                    idx + 1, total, provider.name, provider.model, str(exc)[:100],
                )
                skip_base_url = provider.base_url  # gateway unreachable
            except httpx.ReadTimeout:
                last_error = httpx.ReadTimeout(
                    f"ReadTimeout on {provider.name} model={provider.model}"
                )
                logger.warning(
                    "[%d/%d] %s model=%s READ TIMEOUT after %ds – trying next model",
                    idx + 1, total, provider.name, provider.model, provider.timeout,
                )
                # Don't skip gateway — other models may respond faster
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

        # Handle non-standard gateway error responses (HTTP 200 but error payload)
        # e.g. {"status": "449", "msg": "rate limit"} or {"status": "435", "msg": "Model not support"}
        if "choices" not in data:
            error_status = data.get("status", "unknown")
            error_msg = data.get("msg", str(data)[:200])
            raise RuntimeError(
                f"Gateway error from {provider.name} model={provider.model}: "
                f"status={error_status} msg={error_msg}"
            )

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

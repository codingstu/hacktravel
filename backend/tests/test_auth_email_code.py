"""Tests for email code auth flow without real Redis or SMTP."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.core.exceptions import HKTError
from app.services.auth_service import AuthService


class FakeRedis:
    def __init__(self) -> None:
        self._hashes: dict[str, dict[str, str]] = {}
        self._strings: dict[str, str] = {}

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

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        self._strings[key] = str(value)
        return True

    async def get(self, key: str) -> str | None:
        return self._strings.get(key)

    async def delete(self, key: str) -> int:
        removed = 1 if key in self._strings else 0
        self._strings.pop(key, None)
        self._hashes.pop(key, None)
        return removed

    async def expire(self, key: str, ttl: int) -> bool:
        return True


def test_email_code_login_register_roundtrip():
    async def _run() -> None:
        service = AuthService()
        service._redis = FakeRedis()  # type: ignore[attr-defined]

        email = "test@example.com"
        code = await service.send_email_code(email)

        with pytest.raises(HKTError):
            await service.login_email_code(email, "000000")

        user_data, token, is_new = await service.login_email_code(email, code)
        assert user_data["email"] == email
        assert token
        assert is_new is True

        code2 = await service.send_email_code(email)
        user_data2, token2, is_new2 = await service.login_email_code(email, code2)
        assert user_data2["email"] == email
        assert token2
        assert is_new2 is False

    asyncio.run(_run())

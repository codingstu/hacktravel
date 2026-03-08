"""Custom exceptions and error codes aligned with blueprint Section 3.3."""
from __future__ import annotations

from fastapi import HTTPException


class HKTError(HTTPException):
    """Base project exception with HKT error code."""

    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        request_id: str | None = None,
        retry_after: int | None = None,
    ) -> None:
        detail = {
            "error_code": error_code,
            "message": message,
            "request_id": request_id,
        }
        if retry_after is not None:
            detail["retry_after"] = retry_after
        super().__init__(status_code=status_code, detail=detail)


# ── Concrete errors ──────────────────────────────────────


class InvalidInputError(HKTError):
    def __init__(self, message: str = "Invalid input", request_id: str | None = None):
        super().__init__(400, "HKT_400_INVALID_INPUT", message, request_id)


class DuplicateRequestError(HKTError):
    def __init__(self, message: str = "Duplicate request", request_id: str | None = None):
        super().__init__(409, "HKT_409_DUPLICATE_REQUEST", message, request_id)


class SchemaValidationError(HKTError):
    def __init__(self, message: str = "Schema validation failed", request_id: str | None = None):
        super().__init__(422, "HKT_422_SCHEMA_VALIDATION_FAILED", message, request_id)


class RateLimitedError(HKTError):
    def __init__(
        self,
        message: str = "Rate limited",
        request_id: str | None = None,
        retry_after: int = 60,
    ):
        super().__init__(429, "HKT_429_RATE_LIMITED", message, request_id, retry_after)


class ModelUnavailableError(HKTError):
    def __init__(self, message: str = "Model unavailable", request_id: str | None = None):
        super().__init__(503, "HKT_503_MODEL_UNAVAILABLE", message, request_id)


class ModelTimeoutError(HKTError):
    def __init__(self, message: str = "Model timeout", request_id: str | None = None):
        super().__init__(504, "HKT_504_MODEL_TIMEOUT", message, request_id)


class FallbackCacheMissError(HKTError):
    def __init__(self, message: str = "All models failed and no cache available", request_id: str | None = None):
        super().__init__(599, "HKT_599_FALLBACK_CACHE_MISS", message, request_id)

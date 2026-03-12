"""Auth routes — 用户认证.

POST /v1/auth/register  — 注册
POST /v1/auth/login     — 登录（邮箱密码/手机验证码）
POST /v1/auth/social    — 社交登录
POST /v1/auth/send-code — 发送手机验证码
GET  /v1/auth/me        — 获取当前用户
POST /v1/auth/logout    — 退出登录
GET  /v1/auth/ai-usage  — 查询AI使用次数
"""
from __future__ import annotations

from fastapi import APIRouter, Header, Query
from typing import Optional

from app.models.auth import (
    RegisterRequest,
    LoginRequest,
    SocialLoginRequest,
    SendCodeRequest,
    AuthUser,
    AuthResponse,
    SendCodeResponse,
    LogoutResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest) -> AuthResponse:
    """注册新用户"""
    user_data, token, auto_password = await auth_service.register(
        name=body.name,
        email=body.email,
        email_code=body.email_code,
        phone=body.phone,
        country_code=body.country_code,
        password=body.password,
    )
    msg = ""
    if auto_password and body.email:
        msg = f"密码已发送至 {body.email}"

    return AuthResponse(
        success=True,
        token=token,
        user=AuthUser(
            user_id=user_data["user_id"],
            name=user_data["name"],
            email=user_data.get("email") or None,
            phone=user_data.get("phone") or None,
            avatar_url=user_data.get("avatar_url") or None,
            provider=user_data.get("provider"),
        ),
        is_new=True,
        message=msg,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest) -> AuthResponse:
    """邮箱密码 或 手机验证码登录"""
    if body.email and body.password:
        user_data, token = await auth_service.login_email(body.email, body.password)
        is_new = False
    elif body.email and body.email_code:
        user_data, token, is_new = await auth_service.login_email_code(
            body.email, body.email_code,
        )
    elif body.phone and body.sms_code:
        user_data, token = await auth_service.login_phone(
            body.phone, body.country_code or "+86", body.sms_code,
        )
        is_new = False
    else:
        from app.core.exceptions import InvalidInputError
        raise InvalidInputError("请提供邮箱密码、邮箱验证码或手机验证码")

    return AuthResponse(
        success=True,
        token=token,
        user=AuthUser(
            user_id=user_data["user_id"],
            name=user_data["name"],
            email=user_data.get("email") or None,
            phone=user_data.get("phone") or None,
            avatar_url=user_data.get("avatar_url") or None,
            provider=user_data.get("provider"),
        ),
        is_new=is_new,
    )


@router.post("/social", response_model=AuthResponse)
async def social_login(body: SocialLoginRequest) -> AuthResponse:
    """社交登录（Google / Facebook / Instagram）"""
    user_data, token, is_new = await auth_service.login_social(
        provider=body.provider,
        token=body.token,
        name=body.name,
        email=body.email,
        avatar_url=body.avatar_url,
    )
    return AuthResponse(
        success=True,
        token=token,
        user=AuthUser(
            user_id=user_data["user_id"],
            name=user_data["name"],
            email=user_data.get("email") or None,
            phone=user_data.get("phone") or None,
            avatar_url=user_data.get("avatar_url") or None,
            provider=user_data.get("provider"),
        ),
        is_new=is_new,
    )


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest) -> SendCodeResponse:
    """发送手机验证码"""
    if body.email:
        await auth_service.send_email_code(body.email)
    else:
        await auth_service.send_sms_code(body.phone or "", body.country_code or "+86")
    return SendCodeResponse(
        success=True,
        message="验证码已发送",
        expires_in=300,
    )


@router.get("/me", response_model=AuthResponse)
async def get_me(
    authorization: Optional[str] = Header(default=None),
) -> AuthResponse:
    """获取当前登录用户信息"""
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        from app.core.exceptions import HKTError
        raise HKTError(401, "HKT_401_UNAUTHORIZED", "未登录")

    user_data = await auth_service.verify_token(token)
    if not user_data:
        from app.core.exceptions import HKTError
        raise HKTError(401, "HKT_401_UNAUTHORIZED", "登录已过期，请重新登录")

    return AuthResponse(
        success=True,
        token=token,
        user=AuthUser(
            user_id=user_data["user_id"],
            name=user_data["name"],
            email=user_data.get("email") or None,
            phone=user_data.get("phone") or None,
            avatar_url=user_data.get("avatar_url") or None,
            provider=user_data.get("provider"),
        ),
        is_new=False,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    authorization: Optional[str] = Header(default=None),
) -> LogoutResponse:
    """退出登录"""
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if token:
        await auth_service.logout(token)

    return LogoutResponse(success=True, message="已退出登录")


@router.get("/ai-usage")
async def get_ai_usage(
    device_id: str = Query(..., description="设备标识"),
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """查询 AI 使用次数和是否需要登录"""
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    usage = await auth_service.get_ai_usage(device_id)
    can_use = await auth_service.check_ai_limit(device_id, token or None)

    is_logged_in = False
    if token:
        user = await auth_service.verify_token(token)
        is_logged_in = user is not None

    return {
        "usage": usage,
        "max_free": 3,
        "can_use": can_use,
        "is_logged_in": is_logged_in,
        "need_login": not can_use and not is_logged_in,
    }

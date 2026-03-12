"""Pydantic models for Auth API.

POST /v1/auth/register  — 注册（邮箱/手机）
POST /v1/auth/login     — 登录（邮箱密码/手机验证码/社交登录）
POST /v1/auth/send-code — 发送手机验证码
POST /v1/auth/social    — 社交登录（Google/Facebook/Instagram）
GET  /v1/auth/me        — 获取当前用户
POST /v1/auth/logout    — 退出登录
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    """注册请求"""
    name: str = Field(..., min_length=1, max_length=100, description="用户名")
    email: Optional[str] = Field(default=None, description="邮箱")
    email_code: Optional[str] = Field(default=None, description="邮箱验证码")
    phone: Optional[str] = Field(default=None, description="手机号（含国际区号）")
    country_code: Optional[str] = Field(default=None, description="国家区号，如 +86")
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("邮箱格式不正确")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip()
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 5 or len(digits) > 15:
            raise ValueError("手机号格式不正确")
        return v


class LoginRequest(BaseModel):
    """登录请求（邮箱密码 或 手机验证码）"""
    email: Optional[str] = Field(default=None, description="邮箱")
    email_code: Optional[str] = Field(default=None, description="邮箱验证码")
    phone: Optional[str] = Field(default=None, description="手机号")
    country_code: Optional[str] = Field(default=None, description="国家区号")
    password: Optional[str] = Field(default=None, description="密码")
    sms_code: Optional[str] = Field(default=None, description="短信验证码")


class SocialLoginRequest(BaseModel):
    """社交登录请求"""
    provider: str = Field(..., description="google | facebook | instagram")
    token: str = Field(..., description="OAuth access token")
    name: Optional[str] = Field(default=None, description="用户名")
    email: Optional[str] = Field(default=None, description="邮箱")
    avatar_url: Optional[str] = Field(default=None, description="头像 URL")

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("google", "facebook", "instagram"):
            raise ValueError("不支持的登录方式")
        return v


class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    phone: Optional[str] = Field(default=None, description="手机号")
    country_code: Optional[str] = Field(default=None, description="国家区号，如 +86")
    email: Optional[str] = Field(default=None, description="邮箱")

    @field_validator("email")
    @classmethod
    def validate_send_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("邮箱格式不正确")
        return v

    @field_validator("phone")
    @classmethod
    def validate_send_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip()
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 5 or len(digits) > 15:
            raise ValueError("手机号格式不正确")
        return v

    @model_validator(mode="after")
    def ensure_target(self) -> "SendCodeRequest":
        if not self.email and not self.phone:
            raise ValueError("请提供邮箱或手机号")
        if self.phone and not self.country_code:
            raise ValueError("请提供国家区号")
        return self


class AuthUser(BaseModel):
    """认证用户信息"""
    user_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: Optional[str] = None  # google | facebook | instagram | email | phone
    device_id: Optional[str] = None


class AuthResponse(BaseModel):
    """认证响应"""
    success: bool
    token: str = Field(default="", description="JWT 或 session token")
    user: AuthUser
    is_new: bool = False
    message: str = ""


class SendCodeResponse(BaseModel):
    """发送验证码响应"""
    success: bool
    message: str = ""
    expires_in: int = Field(default=300, description="验证码有效期（秒）")


class LogoutResponse(BaseModel):
    """退出登录响应"""
    success: bool
    message: str = ""

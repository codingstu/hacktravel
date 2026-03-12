"""Auth service — 用户认证 Redis 持久化.

Redis keys:
- hkt:auth:user:{user_id}       → HASH (name, email, phone, password_hash, provider, avatar_url, device_id)
- hkt:auth:email:{email_hash}   → STRING (user_id) 邮箱→用户ID映射
- hkt:auth:phone:{phone_hash}   → STRING (user_id) 手机→用户ID映射
- hkt:auth:social:{provider}:{token_hash} → STRING (user_id)
- hkt:auth:token:{token}        → STRING (user_id) session token
- hkt:auth:sms:{phone_hash}     → STRING (code) 验证码（5分钟过期）
- hkt:auth:email_code:{email_hash} → STRING (code) 邮箱验证码（5分钟过期）
- hkt:auth:usage:{device_hash}  → STRING (count) 匿名AI使用次数
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
import string
import time
import uuid
from typing import Optional

import smtplib
from email.message import EmailMessage

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.exceptions import HKTError

logger = logging.getLogger(__name__)

_KEY_USER = "hkt:auth:user:{}"
_KEY_EMAIL = "hkt:auth:email:{}"
_KEY_PHONE = "hkt:auth:phone:{}"
_KEY_SOCIAL = "hkt:auth:social:{}:{}"
_KEY_TOKEN = "hkt:auth:token:{}"
_KEY_SMS = "hkt:auth:sms:{}"
_KEY_EMAIL_CODE = "hkt:auth:email_code:{}"
_KEY_USAGE = "hkt:auth:usage:{}"

TOKEN_TTL = 30 * 86400  # 30 days
SMS_CODE_TTL = 300  # 5 minutes
MAX_FREE_AI_CALLS = 3


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()[:16]


def _generate_password(length: int = 16) -> str:
    """生成随机复杂密码"""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


def _hash_password(password: str) -> str:
    """简单密码哈希（生产环境建议用 bcrypt）"""
    return hashlib.sha256(password.encode()).hexdigest()


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


def _generate_sms_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


class AuthService:
    """用户认证服务"""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
        return self._redis

    # ── 注册 ──

    async def register(
        self,
        name: str,
        email: Optional[str] = None,
        email_code: Optional[str] = None,
        phone: Optional[str] = None,
        country_code: Optional[str] = None,
        password: Optional[str] = None,
        device_id: Optional[str] = None,
        skip_auto_password: bool = False,
    ) -> tuple[dict, str, str | None]:
        """注册用户。返回 (user_data, token, auto_password)。
        如果是邮箱注册且未设置密码，自动生成密码。"""
        # 检查邮箱是否已注册
        auto_password = None
        if email:
            email_hash = _hash(email)
            existing = await self.redis.get(_KEY_EMAIL.format(email_hash))
            if existing:
                raise HKTError(409, "HKT_409_EMAIL_EXISTS", "该邮箱已注册")

        if phone:
            phone_hash = _hash(f"{country_code}{phone}")
            existing = await self.redis.get(_KEY_PHONE.format(phone_hash))
            if existing:
                raise HKTError(409, "HKT_409_PHONE_EXISTS", "该手机号已注册")

        if email and email_code:
            if not settings.ENABLE_EMAIL_CODE_LOGIN:
                raise HKTError(403, "HKT_403_EMAIL_CODE_DISABLED", "邮箱验证码登录未开启")
            verified = await self.verify_email_code(email, email_code)
            if not verified:
                raise HKTError(401, "HKT_401_INVALID_CODE", "验证码不正确或已过期")

        # 生成密码
        if email and not password and not email_code and not skip_auto_password:
            auto_password = _generate_password()
            password = auto_password

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        token = _generate_token()

        user_data = {
            "user_id": user_id,
            "name": name,
            "email": email or "",
            "phone": f"{country_code}{phone}" if phone and country_code else (phone or ""),
            "password_hash": _hash_password(password) if password else "",
            "provider": "phone" if phone else "email",
            "avatar_url": "",
            "device_id": device_id or "",
            "created_at": str(int(time.time())),
        }

        # 存储用户信息
        await self.redis.hset(_KEY_USER.format(user_id), mapping=user_data)
        await self.redis.expire(_KEY_USER.format(user_id), TOKEN_TTL * 12)

        # 建立索引
        if email:
            await self.redis.set(_KEY_EMAIL.format(_hash(email)), user_id, ex=TOKEN_TTL * 12)
        if phone:
            full_phone = f"{country_code}{phone}" if country_code else phone
            await self.redis.set(_KEY_PHONE.format(_hash(full_phone)), user_id, ex=TOKEN_TTL * 12)

        # 存储 token
        await self.redis.set(_KEY_TOKEN.format(token), user_id, ex=TOKEN_TTL)

        logger.info("Registered user %s via %s", user_id[:8], user_data["provider"])
        return user_data, token, auto_password

    # ── 登录 ──

    async def login_email(self, email: str, password: str) -> tuple[dict, str]:
        """邮箱密码登录"""
        email_hash = _hash(email)
        user_id = await self.redis.get(_KEY_EMAIL.format(email_hash))
        if not user_id:
            raise HKTError(401, "HKT_401_INVALID_CREDENTIALS", "邮箱或密码不正确")

        user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
        if not user_data:
            raise HKTError(401, "HKT_401_INVALID_CREDENTIALS", "用户不存在")

        if user_data.get("password_hash") != _hash_password(password):
            raise HKTError(401, "HKT_401_INVALID_CREDENTIALS", "邮箱或密码不正确")

        token = _generate_token()
        await self.redis.set(_KEY_TOKEN.format(token), user_id, ex=TOKEN_TTL)

        logger.info("Email login for user %s", user_id[:8])
        return user_data, token

    async def login_email_code(self, email: str, code: str) -> tuple[dict, str, bool]:
        """邮箱验证码登录（未注册则自动注册）"""
        if not settings.ENABLE_EMAIL_CODE_LOGIN:
            raise HKTError(403, "HKT_403_EMAIL_CODE_DISABLED", "邮箱验证码登录未开启")

        verified = await self.verify_email_code(email, code)
        if not verified:
            raise HKTError(401, "HKT_401_INVALID_CODE", "验证码不正确或已过期")

        email_hash = _hash(email)
        user_id = await self.redis.get(_KEY_EMAIL.format(email_hash))
        if user_id:
            user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
            token = _generate_token()
            await self.redis.set(_KEY_TOKEN.format(token), user_id, ex=TOKEN_TTL)
            return user_data, token, False

        name = email.split("@")[0] if "@" in email else "Traveler"
        user_data, token, _ = await self.register(
            name=name,
            email=email,
            email_code=None,
            skip_auto_password=True,
        )
        return user_data, token, True

    async def login_phone(self, phone: str, country_code: str, sms_code: str) -> tuple[dict, str]:
        """手机验证码登录（如果未注册则自动注册）"""
        full_phone = f"{country_code}{phone}"
        phone_hash = _hash(full_phone)

        # 验证验证码
        stored_code = await self.redis.get(_KEY_SMS.format(phone_hash))
        if not stored_code or stored_code != sms_code:
            raise HKTError(401, "HKT_401_INVALID_CODE", "验证码不正确或已过期")

        # 删除已使用的验证码
        await self.redis.delete(_KEY_SMS.format(phone_hash))

        # 查找用户
        user_id = await self.redis.get(_KEY_PHONE.format(phone_hash))
        if user_id:
            user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
            token = _generate_token()
            await self.redis.set(_KEY_TOKEN.format(token), user_id, ex=TOKEN_TTL)
            return user_data, token

        # 自动注册
        user_data, token, _ = await self.register(
            name=f"User{phone[-4:]}", phone=phone, country_code=country_code,
        )
        return user_data, token

    async def login_social(
        self, provider: str, token: str,
        name: Optional[str] = None, email: Optional[str] = None,
        avatar_url: Optional[str] = None,
    ) -> tuple[dict, str, bool]:
        """社交登录。返回 (user_data, session_token, is_new)"""
        token_hash = _hash(f"{provider}:{token}")

        # 检查是否已有用户
        user_id = await self.redis.get(_KEY_SOCIAL.format(provider, token_hash))
        if user_id:
            user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
            if user_data:
                session_token = _generate_token()
                await self.redis.set(_KEY_TOKEN.format(session_token), user_id, ex=TOKEN_TTL)
                return user_data, session_token, False

        # 如果有邮箱，检查是否已通过邮箱注册
        if email:
            email_hash = _hash(email)
            user_id = await self.redis.get(_KEY_EMAIL.format(email_hash))
            if user_id:
                # 绑定社交登录
                await self.redis.set(
                    _KEY_SOCIAL.format(provider, token_hash), user_id, ex=TOKEN_TTL * 12,
                )
                user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
                session_token = _generate_token()
                await self.redis.set(_KEY_TOKEN.format(session_token), user_id, ex=TOKEN_TTL)
                return user_data, session_token, False

        # 新用户注册
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        session_token = _generate_token()

        user_data = {
            "user_id": user_id,
            "name": name or f"{provider.title()} User",
            "email": email or "",
            "phone": "",
            "password_hash": "",
            "provider": provider,
            "avatar_url": avatar_url or "",
            "device_id": "",
            "created_at": str(int(time.time())),
        }

        await self.redis.hset(_KEY_USER.format(user_id), mapping=user_data)
        await self.redis.expire(_KEY_USER.format(user_id), TOKEN_TTL * 12)

        if email:
            await self.redis.set(_KEY_EMAIL.format(_hash(email)), user_id, ex=TOKEN_TTL * 12)

        await self.redis.set(_KEY_SOCIAL.format(provider, token_hash), user_id, ex=TOKEN_TTL * 12)
        await self.redis.set(_KEY_TOKEN.format(session_token), user_id, ex=TOKEN_TTL)

        logger.info("Social login (%s) new user %s", provider, user_id[:8])
        return user_data, session_token, True

    # ── 验证码 ──

    async def send_sms_code(self, phone: str, country_code: str) -> str:
        """发送短信验证码（模拟）"""
        full_phone = f"{country_code}{phone}"
        phone_hash = _hash(full_phone)
        code = _generate_sms_code()
        await self.redis.set(_KEY_SMS.format(phone_hash), code, ex=SMS_CODE_TTL)
        logger.info("SMS code sent to %s***: %s", phone_hash[:6], code)
        return code

    async def send_email_code(self, email: str) -> str:
        """发送邮箱验证码（SMTP 可选配置）"""
        if not settings.ENABLE_EMAIL_CODE_LOGIN:
            raise HKTError(403, "HKT_403_EMAIL_CODE_DISABLED", "邮箱验证码登录未开启")

        email_hash = _hash(email)
        code = _generate_sms_code()
        await self.redis.set(_KEY_EMAIL_CODE.format(email_hash), code, ex=SMS_CODE_TTL)

        if not settings.SMTP_HOST or not settings.SMTP_SENDER:
            if settings.DEBUG:
                logger.info("Email code sent to %s***: %s", email_hash[:6], code)
                return code
            raise HKTError(503, "HKT_503_EMAIL_SERVICE_UNAVAILABLE", "邮箱验证码服务未配置")

        await asyncio.to_thread(self._send_email, email, code)
        return code

    async def verify_email_code(self, email: str, code: str) -> bool:
        """验证邮箱验证码并删除"""
        email_hash = _hash(email)
        stored_code = await self.redis.get(_KEY_EMAIL_CODE.format(email_hash))
        if not stored_code or stored_code != code:
            return False
        await self.redis.delete(_KEY_EMAIL_CODE.format(email_hash))
        return True

    def _send_email(self, to_email: str, code: str) -> None:
        message = EmailMessage()
        message["Subject"] = "HackTravel 验证码"
        message["From"] = settings.SMTP_SENDER
        message["To"] = to_email
        message.set_content(f"你的登录验证码是 {code}，5 分钟内有效。")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)

    # ── Token 验证 ──

    async def verify_token(self, token: str) -> Optional[dict]:
        """验证 token 并返回用户信息"""
        user_id = await self.redis.get(_KEY_TOKEN.format(token))
        if not user_id:
            return None
        user_data = await self.redis.hgetall(_KEY_USER.format(user_id))
        return user_data if user_data else None

    async def logout(self, token: str) -> bool:
        """退出登录"""
        result = await self.redis.delete(_KEY_TOKEN.format(token))
        return result > 0

    # ── AI 使用次数 ──

    async def get_ai_usage(self, device_id: str) -> int:
        """获取匿名 AI 使用次数"""
        device_hash = _hash(device_id)
        count = await self.redis.get(_KEY_USAGE.format(device_hash))
        return int(count) if count else 0

    async def increment_ai_usage(self, device_id: str) -> int:
        """增加 AI 使用次数"""
        device_hash = _hash(device_id)
        key = _KEY_USAGE.format(device_hash)
        count = await self.redis.incr(key)
        await self.redis.expire(key, 365 * 86400)
        return int(count)

    async def check_ai_limit(self, device_id: str, token: Optional[str] = None) -> bool:
        """检查是否可以使用 AI。已登录用户无限制，匿名用户限制 3 次。"""
        if token:
            user = await self.verify_token(token)
            if user:
                return True
        usage = await self.get_ai_usage(device_id)
        return usage < MAX_FREE_AI_CALLS


auth_service = AuthService()

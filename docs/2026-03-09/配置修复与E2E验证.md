# 配置修复与 E2E 验证

关联文档：
- 蓝图：[`implementation-blueprint.md`](../../plans/implementation-blueprint.md)
- M1 功能文档：[`M1-后端最小链路.md`](M1-后端最小链路.md)
- 协作规范：[`工程协作与Agent-Skills规范.md`](工程协作与Agent-Skills规范.md)

## 1. 功能目标

修复 M1 后端最小链路中 Docker 部署阶段暴露的 5 项配置问题，通过端到端冒烟测试验证全链路可用。

## 2. 问题清单与修复

### 2.1 端口冲突

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| `docker-compose.yml` 端口映射 | `8000:8000` | `8001:8000` |

**原因**：宿主机 8000 端口已被 `grok2api` 容器占用。
**依据**：`docker ps` 和 `lsof -i :8000` 确认冲突。

### 2.2 `openai.showqr.eu.cc` 调用慢根因排查与修复

| 项目 | 排查结论 | 当前状态 |
|------|----------|----------|
| 网络 / DNS / TLS | 不是瓶颈；直连探测约 `110ms` 返回 `404`，链路建立正常 | 已确认不是网络层慢 |
| 极简 JSON 请求 | `gpt-5.4` 仅返回 `{"ok":true}` 约 `4.4s` | 说明网关与模型基本可用 |
| 原旅行规划大 prompt | 实测约 `101s`，`completion_tokens=5429`、`reasoning_tokens=2225` | 已确认慢点在模型生成阶段 |
| 紧凑 prompt + `reasoning_effort=low` + completion cap | 实测约 `35.8s`，`completion_tokens=1813`、`reasoning_tokens=359` | 已明显改善 |
| OpenAI Compatible 调用细节 | URL 拼装、`response_format`、`trust_env=False` 仍需保留 | 已继续沿用 |

**根因**：[`openai.showqr.eu.cc`](../../backend/app/core/config.py) 慢的主因不是网络、DNS、TLS 或代理，而是 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 里给 [`gpt-5.4`](../../backend/app/core/config.py) 的旅行规划 prompt 过长、输出骨架过大，导致模型生成了超长 JSON，并伴随大量 reasoning token，最终把耗时拉高到 100s 级别。

**修复动作**：
- 在 [`backend/app/core/config.py`](../../backend/app/core/config.py) 新增主路由约束参数：`LLM_PRIMARY_REASONING_EFFORT`、`LLM_PRIMARY_MAX_COMPLETION_TOKENS`、`LLM_PRIMARY_MAX_LEGS`、`LLM_PRIMARY_MAX_TIPS_PER_LEG`
- 在 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 为 primary provider 注入 `reasoning_effort=low` 与 `max_completion_tokens`
- 重写 [`SYSTEM_PROMPT`](../../backend/app/services/llm_gateway.py:132) 与 [`build_user_prompt()`](../../backend/app/services/llm_gateway.py:167)，去掉冗长 JSON 骨架，改成紧凑字段约束
- 在 [`backend/.env.example`](../../backend/.env.example) 同步新的主路由参数模板

### 2.3 模型名称

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| LLM_PRIMARY_MODEL | `codex-5.4` | `gpt-5.4` |

**原因**：用户代理实际注册的模型名为 `gpt-5.4`。
**依据**：用户提供的代理配置截图。

### 2.4 Docker 内部网络连接

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| DATABASE_URL host | `localhost` | `postgres`（Docker 服务名） |
| REDIS_URL host | `localhost` | `redis`（Docker 服务名） |

**原因**：Docker Compose 内部容器间通过服务名解析，不经过宿主机 localhost。
**依据**：`docker compose logs api` 显示连接拒绝 `localhost:6379/5432`。

### 2.5 LLM 调用实现修复

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| URL 拼装 | 固定 `base_url.rstrip('/') + /chat/completions` | 自动兼容三种 `base_url` 形态 |
| JSON 约束 | 依赖 prompt + `stop: ["```\\n"]` | 使用 OpenAI Compatible `response_format={"type":"json_object"}` |
| HTTP 客户端 | `httpx.AsyncClient(timeout=...)` | `httpx.AsyncClient(timeout=..., trust_env=False)` |
| content 解析 | 默认假设为字符串 | 兼容 `message.content` 为数组片段 |

**原因**：模型生成较长 itinerary JSON 时，单靠 prompt 约束不够稳定，且过于固定的 URL 拼装会放大不同代理/中转服务的兼容性问题。
**依据**：[`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 修复后，主供应商可成功返回并解析出 `title`、`summary`、`legs`。

### 2.6 幂等缓存 cache_hit 字段

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| `itinerary_service.py` 幂等返回 | 直接返回原始缓存（`cache_hit: false`） | 设置 `cache_hit: true` 后返回 |

**原因**：幂等键命中时复用了首次生成时的原始响应，其中 `cache_hit` 为 `false`，导致客户端无法区分是否来自缓存。
**依据**：`docker compose logs api` 显示 `Idempotency hit` 日志但响应 `cache_hit: false`。

## 3. 变更文件

| 路径 | 变更类型 | 说明 |
|------|----------|------|
| `docker-compose.yml` | 修改 | 端口映射 `8001:8000` |
| `backend/.env` | 修改 | BASE_URL、MODEL、DB/Redis 连接串 |
| `backend/.env.example` | 修改 | 同步模板 |
| `backend/app/core/config.py` | 修改 | 默认 base_url、model、timeout 值 |
| `backend/app/services/llm_gateway.py` | 修改 | URL 拼装、`response_format`、`trust_env=False`、content 解析兼容 |
| `backend/app/services/itinerary_service.py` | 修改 | 幂等返回设置 `cache_hit: true` |

## 4. E2E 冒烟测试结果

### 4.1 健康检查

```
GET http://localhost:8001/health
→ {"status": "ok", "app": "HackTravel", "env": "local", "api_version": 1}
```

### 4.2 行程生成（首次）

```json
POST /v1/itineraries/generate
{
  "origin": "槟城", "destination": "冲绳",
  "total_hours": 48, "budget": {"amount": 3000, "currency": "CNY"},
  "tags": ["疯狂暴走", "极限吃货"]
}
```

结果：
- 历史一次验证：`primary(timeout) → siliconflow(timeout) → nvidia(成功)`
- 本次已将默认容灾顺序调整为：`primary(showqr fast-fail) → nvidia/llama-3.1-70b → nvidia/nemotron-4-340b → siliconflow/qwen2.5-72b → siliconflow/deepseek-v3 → siliconflow/deepseek-r1`
- 调整原因：[`openai.showqr.eu.cc`](../../backend/app/core/config.py) 当前链路偏慢，且深度思考类 [`DeepSeek-R1`](../../backend/app/core/config.py) 容易显著拉长响应时间，因此放到最后兜底
- 修复 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 后，网关已支持“按供应商 + 按模型”双层降级，并可避免在慢网关上继续级联重试
- 返回结果仍要求可正常解析出 `title`、`summary`、`legs`

### 4.3 查询缓存命中

相同参数、不同 idempotency_key：
- `cache_hit: true`，毫秒级返回，零 Token 消耗

### 4.4 幂等缓存命中

相同 idempotency_key 重复请求：
- `cache_hit: true`，返回相同 `itinerary_id`

## 5. 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `openai.showqr.eu.cc` 仍可能出现慢响应 | 首次命中主路由时接口体验不稳定 | 已缩短主路由超时并关闭同网关默认回退，超时后优先切 NVIDIA NIM |
| `DeepSeek-R1` 深度思考链路耗时偏高 | 极端情况下总链路耗时增长 | 已将 [`DeepSeek-R1`](../../backend/app/core/config.py) 降为硅基流动最后兜底模型 |
| `.env` 含真实 API 密钥 | 泄露风险 | 已加入 `.gitignore`；CI 使用环境变量注入 |
| Git remote 未配置 | 无法 push | 用户就绪时执行 `git remote add origin <url>` |

## 6. 提交信息

```
fix(llm): 优化多供应商模型降级顺序与超时策略

- config: 缩短 `showqr` 主路由超时，并禁用默认同网关级联回退
- config: 将 NVIDIA NIM 调整为第一备选，模型顺序为 Llama 3.1 70B → Nemotron-4 340B
- config: 将 SiliconFlow 调整为第二备选，模型顺序为 Qwen2.5-72B → DeepSeek-V3 → DeepSeek-R1
- llm_gateway: 支持按供应商配置多模型链式降级，减少慢模型优先命中的概率
- env.example: 同步新的模型优先级、超时与回退配置模板
```

Commit hash: `502a81b`

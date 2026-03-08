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

### 2.2 LLM_PRIMARY_BASE_URL 调用链修复

| 项目 | 排查结论 | 当前状态 |
|------|----------|----------|
| `LLM_PRIMARY_BASE_URL` | `https://openai.showqr.eu.cc/v1` 本身可用 | 保持不变 |
| OpenAI Compatible 请求地址拼装 | 需要兼容 `base_url` / `base_url/v1` / `base_url/chat/completions` | 已在 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 修复 |
| 返回 JSON 约束 | 仅靠 prompt + `stop` 不稳定 | 改为 `response_format={"type":"json_object"}` |
| HTTP 客户端环境代理 | 可能受系统代理变量影响 | 已显式 `trust_env=False` |

**原因**：这次问题不在 [`backend/.env`](../../backend/.env) 的主地址本身，而在 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 对 OpenAI Compatible 接口的调用细节不够稳，包括 URL 组装、JSON 输出约束和 HTTP 客户端环境继承。
**依据**：直接请求 `https://openai.showqr.eu.cc/v1/chat/completions` 返回 `200`；修复后通过项目内 [`LLMGateway._call_provider()`](../../backend/app/services/llm_gateway.py:231) 与 [`LLMGateway.generate()`](../../backend/app/services/llm_gateway.py:185) 已可稳定命中主供应商 `codex54`。

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
- 本次针对 [`LLM_PRIMARY_BASE_URL`](../../backend/.env) 的专项排查中，已确认主供应商直连可用
- 修复 [`backend/app/services/llm_gateway.py`](../../backend/app/services/llm_gateway.py) 后，最小链路验证结果为：`provider: codex54`、`model: gpt-5.4`、`switch_count: 0`
- 返回结果可正常解析出 `title`、`summary`、`legs`

### 4.3 查询缓存命中

相同参数、不同 idempotency_key：
- `cache_hit: true`，毫秒级返回，零 Token 消耗

### 4.4 幂等缓存命中

相同 idempotency_key 重复请求：
- `cache_hit: true`，返回相同 `itinerary_id`

## 5. 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Primary 供应商虽已恢复可用，但完整 itinerary 生成仍可能接近 50s | 接口响应偏慢，影响体验 | 后续可减少 prompt 长度、限制输出规模，或增加熔断/降级策略 |
| `.env` 含真实 API 密钥 | 泄露风险 | 已加入 `.gitignore`；CI 使用环境变量注入 |
| Git remote 未配置 | 无法 push | 用户就绪时执行 `git remote add origin <url>` |

## 6. 提交信息

```
fix(llm): 修复 OpenAI Compatible 主供应商调用稳定性

- llm_gateway: 兼容多种 base_url 形态，避免 `/v1` / `/chat/completions` 拼装错误
- llm_gateway: 使用 `response_format={"type":"json_object"}` 约束 JSON 输出
- llm_gateway: `httpx.AsyncClient(..., trust_env=False)`，避免环境代理干扰
- llm_gateway: 兼容 `message.content` 数组片段解析
- 验证主供应商 `codex54 / gpt-5.4` 最小链路调用成功
```

Commit hash: `502a81b`

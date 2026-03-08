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

### 2.2 LLM_PRIMARY_BASE_URL 协议与路径

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| base_url | `https://openai.showqr.eu.cc/` | `http://openai.showqr.eu.cc/v1` |

**原因**：用户代理中转站使用 HTTP 协议，且 OpenAI 兼容 API 需要 `/v1` 路径前缀。
**依据**：用户提供的代理配置截图。

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

### 2.5 LLM 超时阈值

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| `llm_gateway.py` primary timeout | `httpx.Timeout(15.0)` | `httpx.Timeout(connect=10.0, read=60.0)` |
| `llm_gateway.py` backup timeout | `httpx.Timeout(20.0)` | `httpx.Timeout(connect=10.0, read=90.0)` |

**原因**：旅行行程生成需要 LLM 输出较长 JSON，15-20s 不足以完成推理。
**依据**：`docker compose logs api` 显示 `ReadTimeout` 导致三个供应商全部超时。修改后 NVIDIA NIM 在约 16s 内完成推理。

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
| `backend/app/services/llm_gateway.py` | 修改 | 拆分 connect/read 超时 |
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
- 供应商调用链：primary(timeout) → siliconflow(timeout) → **nvidia(成功, 16s)**
- 返回 7 条 legs，总估算 ¥2945
- `cache_hit: false`, `provider: nvidia`, `model: meta/llama-3.1-70b-instruct`

### 4.3 查询缓存命中

相同参数、不同 idempotency_key：
- `cache_hit: true`，毫秒级返回，零 Token 消耗

### 4.4 幂等缓存命中

相同 idempotency_key 重复请求：
- `cache_hit: true`，返回相同 `itinerary_id`

## 5. 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Primary 供应商（gpt-5.4 代理）始终超时 | 每次请求先消耗 60s 等待 | 后续可在 primary 连续失败 N 次后临时跳过（熔断） |
| `.env` 含真实 API 密钥 | 泄露风险 | 已加入 `.gitignore`；CI 使用环境变量注入 |
| Git remote 未配置 | 无法 push | 用户就绪时执行 `git remote add origin <url>` |

## 6. 提交信息

```
fix(infra): 修复LLM配置、端口冲突、超时阈值与幂等缓存标识

- docker-compose: 端口 8000→8001 避让 grok2api
- .env: LLM URL http+/v1, model gpt-5.4, DB/Redis→Docker service name
- llm_gateway: split connect/read timeout (60s/90s)
- itinerary_service: idempotency hit 返回 cache_hit=true
- E2E 冒烟测试通过（生成 + 查询缓存 + 幂等缓存）
```

Commit hash: `502a81b`

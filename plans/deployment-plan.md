# 部署通用清单（VPS + Docker Compose + Caddy）

> 本仓库已新增生产落地文件：`docker-compose.prod.yml`(docker-compose.prod.yml:1)、`Caddyfile`(Caddyfile:1)、`backend/.env.prod.example`(backend/.env.prod.example:1)。

目标：
- 后端：运行 FastAPI + Uvicorn（`CMD ... uvicorn` in `backend/Dockerfile`(backend/Dockerfile:16)），对外提供 `https://api.hacktravel.app`（前端生产分支默认值见 `typescript.getBaseUrl()`(frontend/services/api.ts:43)）。
- 前端 Web：静态站点直接上 Vercel（Expo Web static 输出见 `app.json`(frontend/app.json:29)）。
- 数据：Postgres 用 Supabase（可先仅配置连接串，因当前代码几乎未使用 `DATABASE_URL`(backend/app/core/config.py:25)）；Redis 用 Vercel KV（Upstash Redis）承载缓存/限流/用户资料等（强依赖 `REDIS_URL`(backend/app/core/config.py:28)）。

---

## 0. 结论：后端是否适合 Serverless？

不建议把当前后端直接做成 serverless（如 Vercel Functions）作为主路径：
- 业务存在长耗时外呼 LLM（超时链路与 failover 在 `python.LLMGateway.generate()`(backend/app/services/llm_gateway.py:242) 一侧实现，且单次请求可接近 20-50s 级别，见 `.env.example`(backend/.env.example:13) 的超时设计）。
- serverless 常见风险：执行时长上限、冷启动、并发配额、长连接/流式响应限制、以及到 Redis/外部 API 的网络抖动。

推荐主线：长请求走常驻容器（VPS/容器平台）；serverless 只做轻量静态/边缘逻辑。

---

## 1. 当前后端依赖盘点（决定服务器与托管项）

### 1.1 Redis 是强依赖（不仅是缓存）
Redis 用途来自以下模块：
- 行程缓存 + 幂等键 + 限流：`python.CacheService`(backend/app/services/cache_service.py:30)
  - 缓存 Key：`hkt:cache:*`（行程 JSON）
  - 幂等 Key：`hkt:idem:*`（10 分钟窗口）
  - 限流 Key：`hkt:rl:*`（按 IP 1 小时窗口，调用点见 `python.generate_itinerary()`(backend/app/routes/itinerary.py:52)）
- 用户中心（资料、偏好、收藏行程）：`python.ProfileService`(backend/app/services/profile_service.py:41)
- 盯盘提醒（价格监控）：`python.WatchlistService`(backend/app/services/watchlist_service.py:33)

因此：即使你不用 Postgres，Redis 仍然必须有。

### 1.2 Postgres 目前更像是“预留”
代码层面几乎没有 SQLAlchemy 使用痕迹（仅配置项存在于 `python.Settings`(backend/app/core/config.py:8) 和依赖列表 `backend/requirements.txt`(backend/requirements.txt:10)）。
结论：
- 短期可以先不启用 DB（但仍可在环境中配置 Supabase 连接串，以便未来接入）。
- 如果你准备把社区/用户数据做持久化与可查询，才需要逐步把部分 Redis 数据落到 Postgres。

---

## 2. VPS 服务器配置建议（小流量）

建议起步规格（只跑后端容器 + 反代，不跑本地 Postgres/Redis）：
- 1 vCPU / 1-2GB RAM / 20GB 磁盘
- 开放端口：22（SSH）、80、443
- 关闭对公网暴露的 8000/8001（后端只给 Caddy 访问）

为什么够用：
- 主要算力消耗在外部 LLM API（后端 CPU 更多是 I/O 与 JSON 处理）。
- Redis 走 Vercel KV 托管，VPS 不承载内存型数据。

---

## 3. 生产拓扑（推荐：Caddy 与后端同一 Compose）

```mermaid
flowchart TD
  U[User Browser or App] -->|HTTPS| V[Vercel Static Web]
  U -->|HTTPS api.hacktravel.app| C[Caddy Container on VPS]
  C -->|HTTP (Docker network)| A[FastAPI Uvicorn Container]
  A -->|TLS| R[Vercel KV Upstash Redis]
  A -->|TLS| S[Supabase Postgres]
  A -->|HTTPS| L[LLM Gateways]
```

要点：
- Caddy 负责自动签发证书（Let’s Encrypt）并做反代。
- **宿主机只开放 80/443**；后端容器端口只在 Docker 网络内可见（不直接暴露公网）。

---

## 4. Docker Compose 生产化建议（落地文件）

仓库现有 `docker-compose.yml`(docker-compose.yml:1) 偏向本地开发：包含 `postgres`/`redis` 且 `api` 暴露 `8001:8000`。

生产落地建议（本次已新增）：
- `docker-compose.prod.yml`(docker-compose.prod.yml:1)：仅 `api` + `caddy`（Postgres 用 Supabase，Redis 用 Vercel KV/Upstash）。

端口策略（生产）：
- `api` 只 `expose: 8000` 给同网络的 Caddy 使用。
- `caddy` 映射 `80:80` 与 `443:443` 到宿主机。

---

## 5. Caddy 配置（反代 + 自动 HTTPS，容器方式）

本次已新增 `Caddyfile`(Caddyfile:1)，核心是：
- 域名：`api.hacktravel.app`
- 反代目标：`reverse_proxy api:8000`

这要求：
- `api.hacktravel.app` 的 DNS A/AAAA 指向 VPS 公网 IP。
- VPS 安全组/防火墙放行 80/443（证书签发需要 80 端口的 HTTP-01 校验）。

---

## 6. Supabase + Vercel KV（Upstash Redis）接入（可执行）

你已确认：
- `DATABASE_URL=postgresql+asyncpg://...`（Supabase）
- `REDIS_URL=rediss://default:...@...upstash.io:...`（Upstash，TLS）

落地到 `backend/.env.prod`（参考模板 `backend/.env.prod.example`(backend/.env.prod.example:1)）：

```env
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://***
REDIS_URL=rediss://default:***@***.upstash.io:***
```

验证建议（VPS 上执行）：
- 先启动容器：`docker compose -f docker-compose.prod.yml up -d --build`
- 看日志确认 Redis 连接成功（启动时会打印 `Redis connected`，见 `python.CacheService.connect()`(backend/app/services/cache_service.py:36)）：
  - `docker compose -f docker-compose.prod.yml logs -f --tail=200 api`

说明：
- 当前业务主要依赖 Redis；即使 Supabase 暂时不可用，也不应影响核心接口（但保留 `DATABASE_URL` 以便未来接入持久化）。

---

## 7. 环境变量清单（生产必填/建议）

### 6.1 必填（后端启动必须）
- `APP_ENV=production`（默认 local，见 `python.Settings`(backend/app/core/config.py:8)）
- `DEBUG=false`（生产建议关，见 `python.Settings`(backend/app/core/config.py:8)）
- `REDIS_URL=...`（指向 Vercel KV/Upstash；Redis 强依赖，见 `python.Settings`(backend/app/core/config.py:8)）
- LLM Keys：
  - `LLM_PRIMARY_API_KEY` 等（调用链在 `python.LLMGateway`(backend/app/services/llm_gateway.py:236)）

### 6.2 建议（安全与体验）
- `RATE_LIMIT_ANONYMOUS`（默认 200/h，见 `python.Settings`(backend/app/core/config.py:8)）
- `GOOGLE_GEOCODING_API_KEY`（地图能力，见 `python.Settings`(backend/app/core/config.py:8)）

### 6.3 可选（DB 预留）
- `DATABASE_URL=...`（Supabase；当前未被业务代码使用，但建议先配好，见 `python.Settings`(backend/app/core/config.py:8)）

---

## 7. Vercel KV 30MB 是否够用？怎么判断

你现在 Redis 会存：
- 行程缓存（`python.CacheService.set_cached_itinerary()`(backend/app/services/cache_service.py:84)）：每条行程是 JSON，通常 KB 到十几 KB 级别（取决于 legs 数和字段）。
- profile 与收藏行程（`python.ProfileService`(backend/app/services/profile_service.py:41)）：每用户少量 HASH/ZSET。
- watchlist 提醒（`python.WatchlistService.create_alert()`(backend/app/services/watchlist_service.py:47)）：每邮箱最多 10 条（见 `MAX_ALERTS_PER_EMAIL`(backend/app/services/watchlist_service.py:26)）。
- 限流计数器（`python.CacheService.check_rate_limit()`(backend/app/services/cache_service.py:114)）：极小。

在“内测/个人项目”流量下，30MB 通常可作为起步；真正的压力点更可能来自：
- 缓存 TTL 配置（见 `CACHE_TTL_HOT`/`CACHE_TTL_COLD` in `python.Settings`(backend/app/core/config.py:8)）
- 是否把大量“保存的行程详情”放 Redis（`python.ProfileService`(backend/app/services/profile_service.py:41)）

落地建议：
- 先用托管 Redis 跑通全链路。
- 观察 Redis 内存与 key 数，再决定是否升级或把部分数据迁移到 Postgres。

---

## 8. 前端 Web 直接上 Vercel 是否可以？

可以，原因：
- Expo Web 已配置静态输出：`web.output=static` in `app.json`(frontend/app.json:29)
- 现有产物目录结构符合静态托管：`frontend/dist`(frontend/dist:1)

Vercel 推荐设置：
- Root Directory: `frontend`(frontend/package.json:1)
- Build Command: `npm ci && npx expo export --platform web`（或 `npx expo export:web`，以项目实际 CLI 为准）
- Output Directory: `dist`

生产 API 指向：
- 前端生产环境默认调用 `https://api.hacktravel.app`（见 `typescript.getBaseUrl()`(frontend/services/api.ts:43)）。

---

## 9. 在 VPS 上的实际操作步骤（可执行）

### 9.1 准备 DNS

- `api.hacktravel.app` 添加 A 记录指向 VPS 公网 IPv4（如有 IPv6 再加 AAAA）。
- 确认 VPS 防火墙/安全组放通：80、443。

### 9.2 准备生产环境变量文件（不入库）

在 VPS 上（仓库目录内）创建：`backend/.env.prod`（参考 `backend/.env.prod.example`(backend/.env.prod.example:1)）。

最低要求：
- `APP_ENV=production`
- `DEBUG=false`
- `REDIS_URL=...`（Vercel KV/Upstash 提供的连接串）
- `LLM_PRIMARY_API_KEY=...`（以及备选 provider 的 key）

### 9.3 启动

在 VPS 上执行：

- 构建并启动：
  - `docker compose -f docker-compose.prod.yml up -d --build`
- 查看日志：
  - `docker compose -f docker-compose.prod.yml logs -f --tail=200 caddy api`

### 9.4 验收

- `GET https://api.hacktravel.app/health`（路由见 `python.health()`(backend/app/routes/health.py:11)）
  - 预期：返回 `{"status":"ok",...}`

### 9.5 回滚（最小可操作版）

这个仓库当前 `api` 服务通过 Compose build 直接构建镜像，没有固定 tag。
为了让回滚可控，建议你在上线前做一次小改造：
- 把 `api` 改为显式 `image: hacktravel-api:<tag>`，并在 CI 或 VPS 上用 `docker build -t` 打 tag。

在未做 tag 的前提下，回滚策略只能是：
- `git checkout <上一个 commit>`
- `docker compose -f docker-compose.prod.yml up -d --build`

---

## 10. CORS 与域名

当前后端 CORS 是全放开：`allow_origins=["*"]` in `python.create_app()`(backend/app/main.py:36)

生产建议：
- 改成 allowlist（例如 `https://hacktravel.app`、`https://www.hacktravel.app`，以及 Vercel Preview 域名）。
- 仅对浏览器端有效（App/Expo Go 不依赖 CORS），但仍建议收紧。

---

## 10. 上线验收（最小用例）

- 后端健康检查：`GET https://api.hacktravel.app/health`（路由见 `python.health()`(backend/app/routes/health.py:11)）
- 前端 Web：打开 Vercel 域名，触发一次行程生成，确认请求走到后端（前端会在 dev 打印 BASE_URL，见 `frontend/services/api.ts`(frontend/services/api.ts:87) 的逻辑）

---

## 11. 风险清单（上线前必须处理）

- 仓库中存在真实密钥：`.env`(backend/.env:1) 当前包含 LLM Key，必须移除并轮换。
- 反代与端口暴露：避免把 8000/8001 暴露公网（只开放 80/443）。
- 超时链路：前端总超时 60s（`TIMEOUT_MS` in `frontend/services/api.ts`(frontend/services/api.ts:85)），后端各 provider timeout 要确保总链路在前端超时内（当前 `.env.example`(backend/.env.example:13) 设计已考虑）。

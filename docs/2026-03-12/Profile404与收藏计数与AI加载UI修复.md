# Profile 404 / 收藏计数同步 / AI 加载 UI 轮播优化

## 功能目标

| # | 问题描述 | 优先级 |
|---|---------|--------|
| 1 | `/profile` 直接刷新 Vercel 返回 404 | P0 |
| 2 | 收藏数显示 4，实际 ZSET 只有 2 | P1 |
| 3 | AI 规划加载时文案静止不动，体验差 | P2 |
| 4 | AI 全部失败时错误提示不友好 | P2 |

---

## 变更范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `frontend/vercel.json` | 新建 | SPA catch-all 重写规则 |
| `backend/app/services/profile_service.py` | 修改 | `get_stats` 用真实 zcard / `save_itinerary` 增加去重 |
| `frontend/app/(tabs)/index.tsx` | 修改 | `LOADING_QUIP_KEYS` 新增 3 条 + quipTimerRef 轮播逻辑 |
| `frontend/services/i18n.ts` | 修改 | 新增 zh/en 加载文案 3 条 + 友好错误文案 2 条 |

---

## 关键实现

### 1. Vercel SPA 404 修复

`frontend/vercel.json` 加入 catch-all 重写，所有未知路径返回 `index.html`，由 Expo Router 客户端处理：

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

`app.json` 中 `web.output: "single"` 已在上一轮修复中设置。

### 2. 收藏计数同步（profile_service.py）

**根因**：`save_itinerary()` 每次调用都无条件 `hincrby saved 1`，若同一 itinerary_id 重复保存，计数会叠加但 ZSET 只存一条。

**修复**：
- `save_itinerary()` 先用 `zscore` 检测 ID 是否已在 ZSET，如已存在直接返回，不增计数。
- `get_stats()` 改用 `zcard(itin_list_key)` 获取真实张数，同时将 Redis Hash 中的 `saved` 字段自动校正，防止历史脏数据持续影响展示。

### 3. AI 加载 UI 轮播（index.tsx）

**原来**：进入 loading 时随机取一条文案，整个加载过程静止。

**现在**：
- `LOADING_QUIP_KEYS` 扩展到 10 条（含 `plan.loadingDefault`、`plan.askingLocal`、`plan.balancingTime`、`plan.optimizing`）。
- 新增 `quipTimerRef`（`useRef<ReturnType<typeof setInterval>>`）和 `quipIdxRef`，避免 stale closure 问题。
- `useEffect([viewState])` 监听状态：进入 `loading` 时启动 3.5s 间隔轮播；离开时立即清除定时器并在 cleanup 中再次保障清除。
- `handleGenerate` 初始文案改为 `plan.loadingDefault`；`handleForceAI` 保持 `plan.noPresetAI`。

### 4. 友好化错误文案（i18n.ts）

| key | zh | en |
|-----|----|----|
| `plan.modelTimeout` | `AI 生成超时，请重试（预置路线极速写出，AI重试通常 10s 内完成）` | `AI timed out. Retry now — presets are instant, AI usually finishes in 10s` |
| `plan.allModelsFailed` | `所有 AI 模型当前负载过高，请点击重试，或试试预置路线` | `All AI models are overloaded. Tap Retry or try a preset route` |

---

## 配置变更

- Vercel 部署：新增 `frontend/vercel.json`，需确保已 push 并 Vercel 重新部署。
- 无新增环境变量。

---

## 风险与回滚

| 风险 | 概率 | 回滚方式 |
|------|------|---------|
| vercel.json 规则过于宽泛导致 API 代理失效 | 低（后端独立域名，不经 Vercel） | 删除 rewrites 规则 |
| get_stats 用 zcard 新增一次 Redis 读 | 极低（单次 O(1)） | 回退 get_stats 实现 |
| 加载文案轮播定时器未清理导致内存泄漏 | 极低（cleanup 双重保障） | 移除 useEffect |

---

## 验收标准

- [ ] `https://hacktravel-puce.vercel.app/profile` 直接刷新不再 404
- [ ] 收藏页面计数与实际收藏行程数量一致
- [ ] AI 规划加载超过 3.5s 后文案开始自动切换
- [ ] AI 超时时展示友好提示而非技术报错

---

## 提交记录

```
fix(profile+plan): Vercel SPA 404/收藏计数同步/AI加载UI轮播优化

- 新增 frontend/vercel.json SPA catch-all rewrites
- profile_service: get_stats 改用 zcard 取真实收藏数并自动校正 Hash
- profile_service: save_itinerary 增加 zscore 去重检测
- index.tsx: LOADING_QUIP_KEYS 扩展 + quipTimerRef 3.5s 轮播
- i18n: 新增 askingLocal/balancingTime/optimizing 文案
- i18n: modelTimeout/allModelsFailed 改为更友好的引导文案
```

commit: <!-- backfill after push -->

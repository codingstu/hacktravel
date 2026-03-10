# Expo Go 五项问题修复与 AI 模型优化

## 1. 问题清单

| # | 问题 | 严重度 | 页面 |
|---|------|--------|------|
| 1 | Profile 页面因单个 API 超时导致整页白屏崩溃（AbortError: Aborted） | P0 | Profile |
| 2 | AI 行程规划始终显示"AI 生成超时，请重试" | P0 | Plan (index) |
| 3 | Guides 页面切换 Tab 后报错 "Rendered more hooks than during the previous render" | P0 | Guides (community) |
| 4 | Guides 页面 Tab 切换卡顿（大量 RouteCard 重渲） | P2 | Guides (community) |
| 5 | 全面屏手机底部内容被手势条遮挡 | P2 | 全局 |

## 2. 变更范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `frontend/app/(tabs)/profile.tsx` | 修复 | Promise.allSettled 防崩溃 + 重试按钮 |
| `frontend/app/(tabs)/community.tsx` | 修复+优化 | Hooks 顺序修正 + FlatList 虚拟化 + React.memo |
| `frontend/app/(tabs)/_layout.tsx` | 修复 | useSafeAreaInsets 动态底部安全区 |
| `backend/.env` | 配置 | 主模型改为 gemini-3-flash，备选 gpt-5.2，超时 45s |
| `backend/.env.example` | 配置 | 同步更新示例文件 |
| `backend/app/core/config.py` | 配置 | 默认模型值更新 |
| `backend/app/services/llm_gateway.py` | 文档 | 更新注释中的降级链说明 |

## 3. 关键修复详情

### 3.1 Profile 页面崩溃（Promise.all → Promise.allSettled）

**根因**：`loadData()` 使用 `Promise.all` 并行请求 4 个 API（profile / stats / preferences / itineraries），任一请求超时或失败，`Promise.all` 直接 reject，导致整个 `catch` 分支仅设置一个通用错误状态，页面白屏。

**修复**：
```typescript
const [profileResult, statsResult, prefsResult, itinsResult] =
  await Promise.allSettled([
    api.getProfile(deviceId),
    api.getProfileStats(deviceId),
    api.getPreferences(deviceId),
    api.getSavedItineraries(deviceId),
  ]);

// 每个请求独立兜底
if (profileResult.status === 'fulfilled') {
  setProfile(profileResult.value);
} else {
  setProfile({ display_name: 'Traveler', bio: '', ... });
}
// ... 其余同理
```

**效果**：任意 API 超时不影响其他数据展示，页面不再白屏。新增 Retry 按钮支持一键重连。

### 3.2 AI 行程"超时"问题

**根因（双重）**：
1. **模型选择不当**：原配置使用 `qwen3-235b-a22b-instruct`（不可用）和 `deepseek-v3.1/v3.2`（响应慢/不稳定），全部超时后触发前端"AI 生成超时"提示。
2. **Docker 容器未加载新配置**：使用 `docker compose restart` 不会重新读取 `.env`，必须 `docker compose up -d --build api`。

**模型实测结果**（通过 https://openai.showqr.eu.cc 测试）：

| 模型 | 状态 | 行程生成延迟 | 备注 |
|------|------|-------------|------|
| gpt-5.2 | ✅ 可用 | >35s（超时风险） | JSON 质量高但响应慢 |
| gemini-3-flash | ✅ 可用 | ~13-19s | 响应快，JSON 结构完整 |
| gemini-3-pro | ❌ 502 | - | 服务端错误 |
| qwen3-235b | ❌ 不可用 | - | 不存在或已下线 |

**最终配置**：
```env
LLM_PRIMARY_MODEL=gemini-3-flash      # 主模型（~13s 响应）
LLM_PRIMARY_FALLBACK_MODELS=gpt-5.2   # 备选
LLM_PRIMARY_TIMEOUT=45                # 超时从 35s 增至 45s
```

**降级链**：gemini-3-flash → gpt-5.2 → SiliconFlow(Qwen2.5-72B) → DeepSeek-V3 → DeepSeek-R1 → NVIDIA(glm4.7)

### 3.3 "Rendered more hooks" 错误

**根因**：在 `community.tsx` 中，`useCallback`/`useMemo` hooks 被声明在 `if (loading) return <LoadingView/>` 之后。React 规则要求每次渲染必须调用相同数量的 hooks。当 `loading=true` 时提前返回，跳过了后面的 hooks，导致组件从 loading→loaded 时 hooks 数量增加。

**修复**：将所有 `useCallback`（`renderRouteItem`、`keyExtractor`）和 `useMemo`（`ListHeader`、`ListFooter`）移到 `if (loading)` 之前。

### 3.4 Guides 页面性能优化

**优化措施**：
- `ScrollView` → `FlatList`：开启虚拟化渲染，`maxToRenderPerBatch={5}`，`windowSize={7}`，`removeClippedSubviews={true}`
- `RouteCard` 和 `LegRow` 使用 `React.memo` 包裹，避免无关 state 变更触发整棵卡片树重渲

### 3.5 底部安全区修复

**根因**：`_layout.tsx` 的 `tabBarStyle.paddingBottom` 仅为 `Platform.select({ ios: 0, android: 6 })`，不适配全面屏手机。

**修复**：
```typescript
const insets = useSafeAreaInsets();
const bottomPadding = Math.max(insets.bottom, Platform.select({ ios: 24, android: 12 }) ?? 12);
const tabBarHeight = 56 + bottomPadding;
```

## 4. 测试验证

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 预置路线命中（首尔 48H） | ✅ 通过 | `source=preset, id=preset-首尔-48h` |
| AI 生成（skip_preset=true） | ✅ 通过 | gemini-3-flash ~13s 生成 6 legs 行程 |
| 模型 fallback 链 | ✅ 通过 | gpt-5.2 超时 → 自动切至 gemini-3-flash |
| 缓存命中 | ✅ 通过 | 重复请求命中 Redis 缓存 |
| TypeScript 编译 | ✅ 通过 | `npx tsc --noEmit` 零错误 |
| Docker 容器重建 | ✅ 通过 | 配置正确加载（已验证） |

## 5. 注意事项

- `.env` 变更后必须使用 `docker compose up -d --build api`，`restart` 不会重读 `.env`
- `gemini-3-pro` 目前返回 502，不可作为 fallback
- 前端 hooks 规则：所有 `useCallback`/`useMemo`/`useState` 必须在组件最顶部、任何条件分支之前声明

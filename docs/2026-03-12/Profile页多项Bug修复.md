# Profile 页多项 Bug 修复与交互升级

## 1. 功能目标

修复 Profile 页 5 个已知 Bug，提升行程收藏与展示的完整交互闭环。

1. **保存行程后切换 Tab 不刷新**：存入行程后直接点 Profile Tab 无法展示新收藏，必须强刷页面才能看到。
2. **取消收藏弹 Alert 确认框**：右上角书签按钮触发 `Alert` 二次确认，体验繁琐。
3. **点击已保存行程卡片无反应**：卡片不可点击，无法查看行程详情。
4. **统计栏（行程/收藏/评价）点击无反应**：三个数字为纯展示 `View`，不可交互。
5. **Web 硬刷新 Profile 页出现 "not found"**：`expo web output: static` 静态模式下直接访问子路径 404。

## 2. 变更范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `frontend/app/(tabs)/profile.tsx` | 修改 | 核心 Bug 修复：焦点刷新、无确认框删除、行程详情 Modal、统计Tab 交互 |
| `frontend/app/(tabs)/index.tsx` | 修改 | 新增 `useLocalSearchParams`，支持从 Profile 跳转预填目的地 |
| `frontend/services/i18n.ts` | 修改 | 补充 5 个新增 i18n key（中英双语） |
| `frontend/app.json` | 修改 | `web.output` 从 `"static"` 改为 `"single"`，修复硬刷新 404 |

## 3. 关键实现

### 3.1 Tab 焦点自动刷新（Bug 1）

**原问题**：Profile 页用 `useEffect(() => { loadData(); }, [loadData])` 仅在组件首次 mount 时拉取数据，后续 Tab 切换不触发。

**修复**：引入 `useFocusEffect`（来自 `expo-router`），每次 Tab 获得焦点时重新执行 `loadData()`。

```tsx
// 修复前：只在 mount 时执行
useEffect(() => { loadData(); }, [loadData]);

// 修复后：每次 Tab 聚焦时执行
useFocusEffect(
  useCallback(() => { loadData(); }, [loadData])
);
```

`loadData` 使用 `Promise.allSettled` 并发请求 profile / stats / preferences / itineraries 四个接口，单接口失败不影响整页渲染。

### 3.2 直接取消收藏（Bug 2）

**原问题**：`handleDeleteItinerary` 用 `Alert.alert` 弹出确认框，操作链路长。

**修复**：去掉 Alert，直接调用 `deleteSavedItinerary`，成功后仅更新 `itineraries`（本地状态 filter）和 `stats.saved`（-1），显示 toast 提示"已取消收藏"，不触发整页刷新。

### 3.3 行程详情 Modal（Bug 3）

**方案选择**：已保存的行程记录（`SavedItinerary` 类型）仅存储摘要（title / destination / stops / days / cover_image / saved_at），无 legs 详情数据。后端也无独立的"按 itinerary_id 查询 legs"接口。

**采用方案**：在 Profile 页内弹出行程详情 Modal，展示所有可用摘要字段（封面图 + 目的地 + 站点数 + 天数 + 收藏时间）。提供"重新规划此路线"按钮，通过 `router.push({ pathname: '/(tabs)', params: { destination } })` 跳回 Plan 页并预填目的地，触发新一轮 AI 规划。

Plan 页（`index.tsx`）通过 `useLocalSearchParams<{ destination?: string }>()` 接收参数并用 `useEffect` 写入 `destination` 状态。

### 3.4 统计 Tab 可点互动（Bug 4）

**修复**：将统计栏三个 `View` 改为 `TouchableOpacity`，增加 `activeStatTab` 状态，点击后：
- 显示高亮背景（`backgroundColor: colors.primaryLight`）
- 点击"收藏"后滚动到"已保存行程"区块（通过 `onLayout` 记录 Y 轴位置）

### 3.5 Web 硬刷新 404（Bug 5）

**原因**：`app.json` 中 `web.output: "static"` 为多页静态导出模式，Expo Router 按文件系统生成 HTML，`/profile` 路径需要预渲染才能存在。Caddy 纯代理 API，不服务前端文件。

**修复**：改为 `web.output: "single"`（SPA 单文件模式），打包产物为单一 `index.html` 入口，所有路由均由客户端 Expo Router 处理，Vercel/CDN 自动将所有 404 回退到 `index.html`。

## 4. 配置项变更

| 配置项 | 变更前 | 变更后 | 文件 |
|--------|--------|--------|------|
| `web.output` | `"static"` | `"single"` | `frontend/app.json` |
| 新增 i18n key | — | `profile.removedToast` / `profile.itineraryDetail` / `profile.planAgain` / `profile.destination` / `profile.savedAt`（中英双语） | `frontend/services/i18n.ts` |

## 5. 风险与回滚

| 风险 | 处置 |
|------|------|
| `useFocusEffect` 导致频繁 API 调用 | `loadData` 仅在 focus 时触发；页面内 `isRefresh` 参数区分首次加载与手动刷新，不影响加载态渲染 |
| `web.output: "single"` 影响 SEO | 当前项目为功能性 App，无 SEO 需求；如后续需 SSR 可切换 `"server"` + Expo API Routes |
| 回滚 | `git revert <commit>` 还原 4 个文件；`app.json` 改回 `"static"` 仅需一行修改 |
| 行程详情无 legs 数据 | 已知局限，后续可扩展后端 `GET /v1/profile/itineraries/{id}` 接口返回完整 legs |

## 6. 验收结果

- [x] 保存行程后直接切换到 Profile Tab，行程列表自动刷新出现新条目（无需强刷）
- [x] 点击书签图标直接取消收藏，显示 toast，行程列表即时更新
- [x] 点击行程卡片弹出详情 Modal，展示封面、目的地、站点、天数、收藏时间
- [x] 详情 Modal 中"重新规划此路线"可跳回 Plan Tab 并预填目的地
- [x] 统计栏三项（行程/收藏/评价）均可点击，点击后高亮并滚动到对应区块
- [x] TypeScript 编译零错误（`npx tsc --noEmit` 无输出）

## 7. 对应提交记录

_commit hash 将在提交后回填_

事实依据来源：
- `frontend/app/(tabs)/profile.tsx`（`useFocusEffect` 替换、`handleDeleteItinerary` 简化、`handlePressItinerary`、`handleStatTabPress` 新增、详情 Modal JSX）
- `frontend/app/(tabs)/index.tsx`（`useLocalSearchParams` 引入、`params.destination` 的 `useEffect`）
- `frontend/services/i18n.ts`（zh/en 字典均新增 5 个 key）
- `frontend/app.json`（`web.output: "single"`）

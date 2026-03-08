# M2 前端三 Tab 可用

关联文档：
- 蓝图：[`implementation-blueprint.md`](../../plans/implementation-blueprint.md)
- M1 功能文档：[`M1-后端最小链路.md`](M1-后端最小链路.md)
- 配置修复文档：[`配置修复与E2E验证.md`](配置修复与E2E验证.md)
- 执行清单：[`实施执行清单.md`](实施执行清单.md)

## 1. 功能目标

交付 M2 前端最小链路，对应蓝图 Day 4-10 排期，包括：
- Expo SDK 55 + React Native 0.83 + Expo Router 项目初始化
- 三 Tab 底部导航（极限爆改 / 抄作业 / 盯盘）
- Tab1：输入表单 → 调用后端 API → 垂直时间轴渲染 → 一键导入 Google Maps
- Tab2：社区精选路线瀑布流 + 展开详情 + "我也要抄"入口
- Tab3：雷达扫描动画 + 功能预告 + 邮箱收集表单 + 隐私说明
- 3 条预设热门路线（冲绳 48H / 胡志明 48H / 曼谷 24H）确保首屏不空
- Web 端编译通过（`npx expo export --platform web`）

## 2. 变更范围

### 2.1 新增文件

| 路径 | 职责 |
|------|------|
| `frontend/` | Expo 项目根目录 |
| `frontend/app.json` | Expo 配置（HackTravel 品牌、包名、splash） |
| `frontend/package.json` | 依赖清单 |
| `frontend/tsconfig.json` | TypeScript 配置 |
| `frontend/app/_layout.tsx` | 根布局（主题、导航栈） |
| `frontend/app/(tabs)/_layout.tsx` | Tab 布局（3 Tab + Ionicons + 主题色） |
| `frontend/app/(tabs)/index.tsx` | Tab1 极限爆改（表单 + 时间轴 + 导航） |
| `frontend/app/(tabs)/community.tsx` | Tab2 抄作业（瀑布流 + 展开详情） |
| `frontend/app/(tabs)/watchlist.tsx` | Tab3 盯盘（雷达动画 + 邮箱收集） |
| `frontend/app/modal.tsx` | 路线详情 Modal（占位） |
| `frontend/app/+not-found.tsx` | 404 页面（Expo 模板） |
| `frontend/constants/Theme.ts` | 设计令牌（色系 / 间距 / 字号 / 圆角） |
| `frontend/services/types.ts` | API 类型定义（与后端 Pydantic 一一对应） |
| `frontend/services/api.ts` | API Client（fetch + 超时 + 错误处理） |
| `frontend/services/presets.ts` | 预设路线 + 标签 + 热门目的地 |

### 2.2 修改文件

无（M2 为全新前端项目）

## 3. 关键实现

### 3.1 技术栈

| 项目 | 选型 | 版本 |
|------|------|------|
| 框架 | Expo SDK | 55.0.5 |
| 渲染 | React Native | 0.83.2 |
| 路由 | Expo Router | 55.0.4 |
| 图标 | @expo/vector-icons (Ionicons) | 内置 |
| 动画 | react-native-reanimated + Animated API | 4.2.1 |
| 存储 | @react-native-async-storage | 2.2.0 |
| 语言 | TypeScript | 5.9.2 |

### 3.2 设计系统

- 主色：活力橙 `#FF6B35`（CTA / 时间轴）
- 深蓝底：`#1B2838`（导航 / 汇总卡片）
- 浅灰背景：`#F5F6FA`
- 统一使用 `Theme.ts` 中的 `Colors`、`Spacing`、`FontSize`、`BorderRadius`

### 3.3 Tab1 极限爆改

- **输入区**：出发地/目的地文本框 + 热门目的地横向快捷选择 + 时长/预算数字输入 + 4种偏好标签多选
- **API 调用**：`generateItinerary()` 封装 fetch + AbortController 超时 + ApiError 异常类
- **结果区**：
  - 汇总大卡片（深蓝底 + 总时长/总花费/节点数）
  - 垂直时间轴（橙色节点 + 连线 + 每节点含时间/地点/交通/费用/Tips）
  - 缓存命中徽章（`⚡ 极速缓存`）
- **导航按钮**：`一键导入 Google Maps` 调用 `Linking.openURL()`
- **状态机**：idle → loading（骨架屏文案）→ success → error（重试按钮 + 幽默文案）
- **空态**：3 条预设路线卡片，点击自动填充输入参数

### 3.4 Tab2 抄作业

- **瀑布流**：卡片含标题、时长/预算/被抄次数 meta chips、偏好标签
- **展开详情**：点击卡片展开时间轴摘要 + "我也要抄" + "分享"按钮
- **数据源**：当前使用预设路线；后续对接社区 API

### 3.5 Tab3 盯盘

- **雷达动画**：Animated API 旋转扫描 + 脉冲缩放，深蓝背景
- **功能预告**：底价监控 / 中转拼接 / 降价提醒 / 早鸟特权 4 项功能说明
- **邮箱收集**：输入验证 + 提交成功提示（后续对接 `lead_emails` 表）
- **隐私**：隐私政策链接 + 退订说明

### 3.6 API Client

- 自动检测平台选择 baseURL（Android 模拟器 → `10.0.2.2:8001`，iOS/Web → `localhost:8001`）
- 90s 超时（与后端 LLM 超时对齐）
- 自动生成幂等键（timestamp + random）
- ApiError 类携带 `error_code` 便于前端展示

## 4. 配置项

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Expo SDK | 55 | 最新稳定版 |
| scheme | `hacktravel` | 深链 URL scheme |
| bundleIdentifier | `app.hacktravel.mobile` | iOS |
| package | `app.hacktravel.mobile` | Android |
| splash backgroundColor | `#FF6B35` | 品牌橙 |
| web output | `static` | 静态导出，适配 Vercel |

## 5. 验收结果

| 验收项 | 状态 | 说明 |
|--------|------|------|
| Web 编译 | ✅ 通过 | `npx expo export --platform web` 成功，9 个路由 |
| TypeScript 类型检查 | ✅ 通过 | 项目代码零错误（模板遗留组件除外） |
| Dev server 启动 | ✅ 通过 | `http://localhost:8082` 返回 HTTP 200 |
| Tab 导航 | ✅ 通过 | 3 Tab 正确渲染（极限爆改/抄作业/盯盘） |
| 预设路线渲染 | ✅ 通过 | 首屏展示 3 条热门路线 |
| API Client | ✅ 通过 | 类型定义与后端 Pydantic 对齐 |
| Web bundle | 2.3MB | 含全部路由，后续可优化 |

## 6. 已知风险与 TODO

| 风险/TODO | 影响 | 缓解措施 |
|-----------|------|----------|
| Web shadow* 样式 deprecated 警告 | 仅影响 Web 端，RN 端无影响 | 后续迁移到 `boxShadow` |
| Tab2 "我也要抄" 点击未对接 API | 功能占位，不影响使用 | M3 对接社区路线 API |
| Tab3 邮箱提交未对接后端 | 数据不持久化 | M3 新增 `/v1/leads` 接口 |
| 模板遗留组件（EditScreenInfo 等）类型错误 | 不影响运行 | 可删除 |
| async-storage v3→v2 降级 | Expo SDK 55 期望 v2 | 已降级到 2.2.0 |

## 7. 提交信息

```
feat(app): M2 前端三Tab可用 — 极限爆改/抄作业/盯盘

- Expo SDK 55 + Expo Router + TypeScript 项目初始化
- Tab1: 输入表单→API调用→垂直时间轴→一键Google Maps导航
- Tab2: 社区精选路线瀑布流+展开详情
- Tab3: 雷达扫描动画+邮箱收集+功能预告
- 3条预设热门路线(冲绳/胡志明/曼谷)确保首屏不空
- API Client对接后端，类型与Pydantic对齐
- Web编译通过，dev server正常运行
```

Commit hash: `147178f`

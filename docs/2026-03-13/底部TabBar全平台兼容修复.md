# 底部 TabBar 全平台兼容修复

**日期：** 2026-03-13
**状态：** 已完成

## 问题描述

底部 Tab 导航栏在以下场景出现文字/图标被截断、不完整显示：
- Web 端（桌面浏览器、移动端浏览器）
- 全面屏手机（手势导航横条区域遮挡）
- 部分 Expo Go 测试设备

## 根因分析

1. **Web viewport 缺少 `viewport-fit=cover`**：iOS Safari 等浏览器无法正确报告安全区域 insets，`useSafeAreaInsets().bottom` 始终返回 0。
2. **HTML 根元素使用 `height: 100%`**：移动浏览器的地址栏和底部导航栏不被排除，导致实际可视区域小于 `100%`，TabBar 被推出屏幕底部。
3. **`Platform.select` 未覆盖 `web` 平台**：`Platform.select({ ios: 24, android: 12 })` 在 web 上返回 `undefined`，最终 fallback 到 12px，padding 不足。
4. **根布局缺少显式 `SafeAreaProvider`**：虽然 Expo Router 内部包含 `SafeAreaProviderCompat`，但未在最外层显式提供，导致部分设备 insets 检测不完整。

## 修复内容

### 1. 新增 `app/+html.tsx`（Web 专用 HTML 文档）
- viewport meta 增加 `viewport-fit=cover`，使 iOS Safari 报告安全区域
- 根元素使用 `100dvh`（动态视口高度）替代 `100%`，排除移动浏览器 chrome
- 添加 `env(safe-area-inset-*)` CSS 补位，兼容旧版 `constant()` 前缀

### 2. 修复 `app/(tabs)/_layout.tsx`（Tab 布局）
- `Platform.select` 显式覆盖 `web`/`ios`/`android`/`default` 四平台
- 提取 `MIN_BOTTOM_PADDING` 和 `TAB_CONTENT_HEIGHT` 为命名常量
- Web 端 tabBarStyle 增加 `position: sticky` + `zIndex: 100` 确保不被截断
- `paddingTop` 从 8 调整为 6，给底部更多空间

### 3. 修复 `app/_layout.tsx`（根布局）
- 在最外层添加 `SafeAreaProvider` 包裹，确保所有子组件可正确获取 insets

## 影响范围

| 文件 | 变更类型 |
|------|---------|
| `frontend/app/+html.tsx` | 新增 |
| `frontend/app/(tabs)/_layout.tsx` | 修改 |
| `frontend/app/_layout.tsx` | 修改 |
| `docs/plan.md` | 更新 |

## 验证

- [x] TypeScript 类型检查通过（零错误）
- [x] Jest 单元测试全部通过（26/26）
- [x] 无新增依赖引入

## 风险

- `position: sticky` 在极少数旧版浏览器（<iOS 13）可能降级为 `relative`，但这些浏览器已不在目标支持范围内。
- `100dvh` 需要 Safari 15.4+ / Chrome 108+；fallback 到 `100%` 保底。

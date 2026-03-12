# 地区自适应 Disclaimer 与 UI/UX 体验优化

**日期:** 2026-03-13
**类型:** feat + refactor

---

## 变更概览

### 1. 地区自适应 Disclaimer 系统

基于大洲 + 语言双维度，在行程结果页底部展示地区感知免责提示，推荐当地主流购票平台。

**新增文件:**
- `frontend/services/disclaimer.ts` — 6 大洲 × 2 语种免责文案映射
- `frontend/components/DisclaimerBanner.tsx` — 免责提示 UI 组件

**技术方案:**
- 复用 `region.ts` 的 `inferContinentFromTimezone()` 检测用户所在大洲
- 复用 `i18n.ts` 的 `currentLocale` 匹配 zh/en 文案
- 后端预留 `PolicyInfo.disclaimer` 字段，服务端文案优先级高于前端

### 2. 前后端 PolicyInfo 类型对齐

**修改文件:**
- `backend/app/models/itinerary.py` — 新增 `disclaimer: str` 字段
- `frontend/services/types.ts` — 修正 `PolicyInfo` 定义对齐后端

### 3. 共享 UI 组件提取

消除 3 处 Toast 重复、2 处 TimelineLeg 重复、2 处 ACTIVITY_ICON_MAP 重复。

**新增文件:**
- `frontend/components/Toast.tsx` — 统一全局 Toast（动画淡入淡出）
- `frontend/components/SkeletonCard.tsx` — 骨架屏加载态（替代纯 spinner）
- `frontend/components/TravelItemCard.tsx` — 统一行程卡片（full/compact 模式）
- `frontend/constants/activityIcons.ts` — 活动图标映射常量

### 4. 四 Tab 页集成与交互增强

**修改文件:**
- `frontend/app/(tabs)/index.tsx` — 集成骨架屏、Disclaimer、Toast、输入区图标标签
- `frontend/app/(tabs)/community.tsx` — TravelItemCard compact 模式、Toast 统一、toggle chip 样式
- `frontend/app/(tabs)/profile.tsx` — Modal X 关闭按钮、空提醒状态 CTA、Toast 统一
- `frontend/app/(tabs)/watchlist.tsx` — 雷达环旋转动画激活、标签间距增大
- `frontend/services/i18n.ts` — 新增 `profile.setEmailHint`、`profile.goSetAlert` 词条

### 5. 单元测试

**新增文件:**
- `frontend/__tests__/services/disclaimer.test.ts` — 19 条测试覆盖全大洲×双语种×回退逻辑

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | 0 错误 |
| 前端测试 | 26/26 通过 |
| 后端测试 | 66 通过（4 条预存失败，与本次无关） |

---

## 风险

- 大洲级粒度无法区分同洲不同国（如中国 vs 日本），通过 locale 区分 zh/en 部分缓解
- IP 地理定位国家级检测留作 Phase 2

## 如何验证

1. 启动前端，生成行程后滚动到底部查看 Disclaimer 文案是否匹配设备时区大洲 + 语言
2. 加载态确认骨架屏替代了纯 spinner
3. 社区页展开行程确认 TravelItemCard compact 模式
4. Profile 页行程 Modal 确认 X 关闭按钮 + 空提醒确认 CTA 按钮
5. 盯盘页确认雷达环旋转动画

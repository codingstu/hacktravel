# Profile 收藏行程：详情可查看 + 编辑入口修复（2026-03-13）

## 目标与问题

Profile 页“已保存行程”此前只存摘要字段，导致：
- 收藏卡片可能无图或图片加载失败后空白
- 点开详情看不到真实路线明细（legs），steps/flag 点击无响应
- 无法把收藏路线带回 Plan 继续编辑

本次改动补齐“收藏详情链路”，并保持列表接口轻量。

## 方案概览

- 列表接口继续只返回摘要：`GET /v1/profile/itineraries`
- 新增详情接口按需返回完整内容：`GET /v1/profile/itineraries/{itinerary_id}?device_id=...`
- 保存收藏时可选写入 `context` + `generated`（对应 Redis `context_json` / `generated_json`）
- 前端：Profile 弹窗加载详情并渲染 legs 时间轴；提供“编辑路线”跳转 Plan；Plan 支持按 `itinerary_id` 拉取收藏详情进入可编辑态

## 后端改动

### 数据模型

- `SavedItineraryContext`：用于编辑回填（origin/destination/total_hours/budget/tags/continent/sub_region）
- `SavedItineraryDetail`：在 `SavedItinerary` 基础上增加 `context?` 与 `generated?`
- `SaveItineraryRequest`：新增可选字段 `context`、`generated`

对应文件：
- backend/app/models/profile.py

### 接口

- `GET /v1/profile/itineraries/{itinerary_id}`
  - Query: `device_id`
  - Response: `{ success, message, itinerary }`
  - 若该 itinerary 不属于该 device 或不存在：`success=false`、`itinerary=null`

对应文件：
- backend/app/routes/profile.py

### Redis 存储

- `hkt:profile:itinerary:{itinerary_id}` HASH 增加：
  - `context_json`（可选）
  - `generated_json`（可选）
- 列表 `list_itineraries()` 会剔除上述字段，保证列表摘要轻量

对应文件：
- backend/app/services/profile_service.py

## 前端改动

### Profile

- 收藏列表卡片封面图：`onError` 失败回退（按 `itinerary_id` 记录失败状态）
- 统计区：仅保留 `Saved`
- 详情弹窗：
  - 点击收藏卡片后先显示加载态，再请求详情接口
  - 点击 steps/flag 切换展开 `generated.legs` 时间轴
  - 提供“编辑路线”按钮跳转 Plan（携带 `itinerary_id`）

对应文件：
- frontend/app/(tabs)/profile.tsx

### Plan

- 支持 URL 参数 `itinerary_id`
  - 进入页面后拉取收藏详情
  - 回填表单（origin/destination/hours/budget/tags/continent/sub_region）
  - 若有 `generated`：直接进入可编辑态（填充 editable legs）
- 保存收藏时：把 `context` + `generated` 一起提交，确保下次点开能看到真实 legs

对应文件：
- frontend/app/(tabs)/index.tsx

### API/类型/i18n

- 新增 `fetchSavedItineraryDetail()`
- 新增 `SavedItineraryDetail*` 类型
- 新增文案 key：`profile.noItineraryDetails`

对应文件：
- frontend/services/api.ts
- frontend/services/types.ts
- frontend/services/i18n.ts

## 验收步骤

1. Plan 生成一条路线 → 点击“保存行程”
2. 进入 Profile → 在“已保存行程”列表点开该卡片
3. 期望：
   - 卡片有封面图（图片失败时会自动回退到内置目的地图）
   - 弹窗先出现 Loading，再展示 legs
   - 点击 steps/旗子区域可展开/收起时间轴
   - 点击“编辑路线”跳转 Plan，进入可编辑态并可增删/移动节点

## 已知限制

- 历史收藏若当时未保存 `generated_json`（旧数据），详情会提示“暂无路线详情”。需要用户重新保存一次（或再规划一次）才能获得可编辑 legs。

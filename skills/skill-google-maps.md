# Skill: google-maps

关联文档：
- [`implementation-blueprint.md`](plans/implementation-blueprint.md)
- [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)

## 1. 适用场景

用于实现 Google Maps 一键导入能力，包括站点组装、平台差异处理、超限分段与失败回退。

## 2. 前置条件

- 已拿到标准化地点列表
- 每个地点至少具备名称或经纬度
- 已明确前端所在平台：iOS、Android、Web

## 3. 操作步骤

1. 从行程 legs 中提取 origin、destination、waypoints
2. 生成统一 Google Maps deeplink
3. 处理 waypoint 数量超限时的分段策略
4. Android 优先唤起 Google Maps
5. iOS 优先 universal link，失败回浏览器
6. Web 新标签页打开链接
7. 深链失败时提供复制链接与逐段导航
8. 更新 `docs/YYYY-MM-DD/功能点.md`
9. 执行 Git 提交并 push

## 4. 验收标准

- 链接参数完整
- 主流平台可正常拉起导航
- 超限场景有分段回退
- 失败时仍可复制链接继续使用

## 5. 失败回退

- 改为浏览器打开
- 展示文本导航列表
- 提供站点复制能力

## 6. 产出物

- 地图链接生成逻辑
- 平台兼容处理代码
- 功能文档
- `feat(maps): ...` 提交记录

# Skill: itinerary-api

关联文档：
- [`implementation-blueprint.md`](plans/implementation-blueprint.md)
- [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)

## 1. 适用场景

用于新增或调整行程生成相关 API，包括请求参数、响应结构、错误码、Pydantic 校验与幂等处理。

## 2. 前置条件

- 已有明确任务卡
- 已确认接口版本与字段变更范围
- 已明确是否影响缓存与模型路由

## 3. 操作步骤

1. 定义请求与响应模型
2. 对齐错误码前缀 `HKT`
3. 加入输入校验与幂等键处理
4. 补充日志字段与 `request_id`
5. 验证成功、失败、超时、缓存命中路径
6. 更新 `docs/YYYY-MM-DD/功能点.md`
7. 执行 Git 提交并 push

## 4. 验收标准

- 输入输出符合蓝图契约
- 错误码明确
- 日志可追踪
- 文档与提交记录完整

## 5. 失败回退

- 回滚新增路由或新字段
- 恢复上一版响应结构
- 保持旧客户端兼容

## 6. 产出物

- API 代码
- 模型定义
- 功能文档
- `feat(api): ...` 提交记录

# Skill: llm-failover

关联文档：
- [`implementation-blueprint.md`](plans/implementation-blueprint.md)
- [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)

## 1. 适用场景

用于实现或调整大模型网关、多供应商容灾、超时控制、5xx 自动切换与缓存回退策略。

## 2. 前置条件

- 已明确主路由与备路由优先级
- 已有统一供应商抽象层
- 已定义超时阈值、重试边界与熔断条件

## 3. 操作步骤

1. 定义统一 LLM Provider 接口
2. 接入主路由 `Codex 5.4`
3. 接入备路由：硅基流动、NVIDIA NIM
4. 实现超时、5xx、连接错误自动切换
5. 全部失败时读取缓存路线
6. 记录 provider、model、切换次数与耗时
7. 更新 `docs/YYYY-MM-DD/功能点.md`
8. 执行 Git 提交并 push

## 4. 验收标准

- 主路由正常时优先命中 `Codex 5.4`
- 超时或 5xx 可自动切换到备路由
- 全失败时能正确回退缓存
- 日志可定位到具体供应商与失败原因

## 5. 失败回退

- 关闭自动切换，暂时退回单供应商模式
- 禁用异常供应商配置
- 启用只读缓存兜底

## 6. 产出物

- LLM 网关代码
- 供应商适配层
- 容灾验证记录
- 功能文档
- `feat(llm): ...` 提交记录

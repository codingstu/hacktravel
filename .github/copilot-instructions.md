# Copilot Instructions

本仓库使用先读地图的工作流。完整规则见 `AGENTS.md`。

## 关键文件

- `AGENTS.md` — 工作流规则、代码审查清单、反幻觉规则
- `docs/spec.md` — 产品规格
- `docs/architecture.md` — 模块边界和约定
- `docs/plan.md` — 当前工作和下一步
- `docs/commands.md` — 精确的开发/测试/lint/构建命令
- `docs/decisions.md` — 过去的权衡
- `plans/implementation-blueprint.md` — HackTravel 实施蓝图与数据契约

## 代码生成规则

1. **写之前先读。** 生成代码前理解规格和架构。
2. **最小变动。** 只生成任务要求的内容——不做推测性功能。
3. **遵循现有模式。** 匹配项目的命名、结构和风格约定。
4. **测试覆盖。** 生成功能时，同时生成或更新测试。
5. **无幻觉。** 不要引用代码库中不存在的文件、函数或 API。不确定时先检查。
6. **小函数。** 生成的函数不超过 50 行，文件不超过 200 行。按职责拆分。
7. **领域命名。** 使用具体的描述性名称——避免 `utils`、`helpers`、`data`、`stuff`。
8. **错误处理。** 始终处理错误路径，不只是正常路径。
9. **类型安全。** 优先使用有类型的代码。在函数边界使用显式类型。
10. **自我验证。** 变更后，运行质量门控：lint → 类型检查 → 测试 → 构建。

## HackTravel 特定约束

- 后端使用 FastAPI + Pydantic，前端使用 Expo + React Native + TypeScript。
- 匿名优先可用，登录默认关闭。
- 主模型 Codex 5.4，主备全失败回退缓存。
- 错误码前缀 `HKT`，日志含 `request_id`。
- 行程字段经 Pydantic 严格校验。

## 代码审查

审查代码时，使用 `AGENTS.md` §7 中的清单：
- 正确性、质量、测试、架构、文档。

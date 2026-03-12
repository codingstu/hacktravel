# Prompt Template: review-output

> 遵循 `AGENTS.md` §7 代码审查清单。

你正在审查 HackTravel 的一次功能交付，请严格遵守以下规则：

## 0. 上下文

先阅读：`AGENTS.md`（§7 代码审查清单、§8 组件拆分）、`docs/architecture.md`、`docs/spec.md`。

## 1. 审查目标

- 检查实现是否符合 `plans/implementation-blueprint.md`
- 检查是否遵守 `AGENTS.md` 和 `docs/architecture.md` 的模块边界
- 检查文档、提交、回滚信息是否完整

## 2. 审查清单（对齐 AGENTS.md §7）

### 正确性
- 功能边界是否清晰
- 是否存在无关改动
- 输入输出契约是否一致
- 边界情况和错误路径是否已处理

### 质量
- 函数和文件大小合理
- 命名清晰且领域专用
- 没有遗留死代码或 TODO hack

### 测试
- 新/变更行为有测试覆盖
- 所有测试通过

### 架构
- 遵循 `docs/architecture.md` 模块边界
- 依赖方向向内流动

### HackTravel 约束
- 错误码使用 `HKT` 前缀
- 日志含 `request_id`
- 主备切换策略遵循

### 文档
- 是否更新 `docs/YYYY-MM-DD/功能点.md`
- Git 提交信息是否符合 `feat(scope): 摘要`
- 是否具备回滚说明

## 3. 输出格式

请按以下结构输出：

1. 审查结论
2. 符合项
3. 风险项
4. 必改项
5. 建议项
6. 文档检查结果
7. Git 记录检查结果

## 4. 完成定义

只有在以下条件都满足时才算审查完成：

- 蓝图一致性已核对
- 文档完整性已核对
- Git 记录规范已核对
- 必改项与建议项已分离

# Prompt Template: review-output

你正在审查 HackTravel 的一次功能交付，请严格遵守以下规则：

## 1. 审查目标

- 检查实现是否符合 [`implementation-blueprint.md`](plans/implementation-blueprint.md)
- 检查是否遵守 [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)
- 检查文档、提交、回滚信息是否完整

## 2. 审查清单

- 功能边界是否清晰
- 是否存在无关改动
- 输入输出契约是否一致
- 错误处理与日志是否完备
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

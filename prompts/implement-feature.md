# Prompt Template: implement-feature

你正在实现 HackTravel 的一个单一功能点，请严格遵守以下规则：

## 1. 目标

- 只实现当前功能点，不扩散范围
- 保持与 [`implementation-blueprint.md`](plans/implementation-blueprint.md) 一致
- 保持与 [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md) 一致
- 先恢复项目记忆，再开始实现，避免因会话切换或上下文过长丢失约束

## 2. 强制约束

- 实现前必须先读取 [`implementation-blueprint.md`](plans/implementation-blueprint.md)、最近的 `docs/YYYY-MM-DD/*.md`、相关 `agents/*.md`、`skills/*.md`
- 如果事实源中没有定义，就必须明确标记“未定义”，禁止脑补
- 匿名优先可用
- 登录入口默认关闭
- 主模型为 Codex 5.4
- 备路由为硅基流动、NVIDIA NIM
- 主备全失败时必须回退缓存
- 完成后必须更新 `docs/YYYY-MM-DD/功能点.md`
- 完成后必须执行一次 Git 提交并 push 到 `main`
- 提交格式固定为 `feat(scope): 摘要`

## 3. 输出要求

请按以下结构输出：

1. 功能边界
2. 变更文件清单
3. 核心实现说明
4. 验收结果
5. 风险与回滚
6. 文档路径
7. Git 提交信息
8. commit hash

## 4. 完成定义

只有在以下条件都满足时才算完成：

- 代码实现完成
- 最小验证完成
- 文档已更新
- 已 commit
- 已 push

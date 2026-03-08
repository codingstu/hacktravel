# Prompt Template: fix-bug

你正在修复 HackTravel 的一个缺陷，请严格遵守以下规则：

## 1. 目标

- 先复现问题，再定位根因
- 采用最小改动完成修复
- 不做无关重构

## 2. 强制约束

- 修复过程不得破坏 [`implementation-blueprint.md`](plans/implementation-blueprint.md) 的既定约束
- 修复完成后必须更新 `docs/YYYY-MM-DD/故障修复-功能点.md`
- 修复完成后必须执行一次 Git 提交并 push 到 `main`
- 提交格式固定为 `feat(scope): 修复摘要`

## 3. 输出要求

请按以下结构输出：

1. 问题现象
2. 复现步骤
3. 根因分析
4. 修复文件清单
5. 回归验证结果
6. 风险与回滚
7. 文档路径
8. Git 提交信息
9. commit hash

## 4. 完成定义

只有在以下条件都满足时才算完成：

- 问题已复现
- 根因已定位
- 修复已验证
- 文档已更新
- 已 commit
- 已 push

# Skill: doc-and-commit

关联文档：
- [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)
- [`实施执行清单.md`](docs/2026-03-09/实施执行清单.md)

## 1. 适用场景

用于任何功能点交付后的收尾动作，确保文档记录、Git 提交与 push 全部完成。

## 2. 前置条件

- 功能代码已完成
- 最小验证已完成
- 已明确本次功能点名称与 scope

## 3. 操作步骤

1. 新建文档 `docs/YYYY-MM-DD/功能点.md`
2. 写入目标、范围、关键实现、配置变更、验收结果、风险与回滚
3. 统计本次变更文件列表
4. 执行 `git add`
5. 执行 `git commit -m "feat(scope): 摘要"`
6. 执行 `git push origin main`
7. 将 commit hash 回填到功能文档

## 4. 验收标准

- 文档路径与命名正确
- 文档章节完整
- commit message 符合规范
- 变更已 push 到 `main`
- 文档包含 commit hash

## 5. 失败回退

- push 失败时保留本地 commit，记录失败原因
- commit message 不合规时 amend 后重新提交
- 文档缺失时禁止进入下一功能点

## 6. 产出物

- 功能文档
- 清晰的 Git 历史
- `feat(scope): ...` 提交记录

# HackTravel Agent 与 Skills 目录规范

关联文档：
- [`implementation-blueprint.md`](plans/implementation-blueprint.md)
- [`工程协作与Agent-Skills规范.md`](docs/2026-03-09/工程协作与Agent-Skills规范.md)

## 1. 目录约定

建议在仓库建立以下目录：

- `agents/`
- `skills/`
- `prompts/`
- `docs/YYYY-MM-DD/`

说明：
- `agents` 存放角色配置
- `skills` 存放可复用执行手册
- `prompts` 存放任务模板
- `docs` 存放按日期和功能点归档的研发记录

## 2. Agent 配置文件规范

### 2.1 文件命名

- `agents/architect.md`
- `agents/code.md`
- `agents/debug.md`

### 2.2 文件结构

每个 Agent 文件固定包含：

1) 角色目标
2) 输入
3) 输出
4) 执行边界
5) 完成定义
6) 交接要求

## 3. Skills 文件规范

### 3.1 文件命名

- `skills/skill-itinerary-api.md`
- `skills/skill-llm-failover.md`
- `skills/skill-google-maps.md`
- `skills/skill-doc-and-commit.md`

### 3.2 每个 Skill 必填章节

1) 适用场景
2) 前置条件
3) 操作步骤
4) 验收标准
5) 失败回退
6) 产出物

## 4. Prompt 模板文件规范

### 4.1 文件命名

- `prompts/implement-feature.md`
- `prompts/fix-bug.md`
- `prompts/review-pr.md`

### 4.2 内容要求

每个模板需显式包含：

- 功能边界
- 一致性约束
- 文档更新要求
- Git 提交要求
- 输出格式要求

## 5. 与 docs 联动规则

任意 Agent 通过任意 Skill 完成功能点后，必须同步：

1. 新增 `docs/YYYY-MM-DD/功能点.md`
2. 写明引用了哪些 Agent 与 Skill
3. 写明对应 commit hash

## 6. 最小 Skill 清单

首批必须具备：

- itinerary-api：行程接口、校验、错误码
- llm-failover：主备模型切换与超时策略
- maps-deeplink：导图链接组装与回退
- expo-tab-page：Tab 页面交付规范
- doc-and-commit：文档更新与提交 push

## 7. 验收条件

满足以下条件视为规范落地：

- 仓库存在 `agents` `skills` `prompts` 目录
- 至少具备 3 个 Agent 配置文件
- 至少具备 5 个 Skills 文档
- 至少具备 3 个 Prompt 模板
- 任意一次功能交付都能在 docs 找到记录与提交号

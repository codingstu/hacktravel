# HackTravel 工程协作与 Agent Skills 规范

关联蓝图文档：
- [`implementation-blueprint.md`](plans/implementation-blueprint.md)

## 1. 目标

本规范用于约束后续实现阶段的协作方式，确保以下事项强制落地：

- 每完成一个功能点，必须同步更新文档到 docs
- 文档路径按日期和功能点划分
- 每完成一个功能点，必须完成一次清晰的 Git 提交并 push
- Agent、Skills、Prompt、代码规范有统一模板可复用

## 2. 分支与提交策略

- 固定使用 main 分支直推
- 每个功能点完成后立即提交并 push
- 提交信息格式固定为：feat(scope): 摘要

示例：
- feat(api): 新增行程生成接口与模型回退
- feat(app): 完成时间轴渲染与导图按钮
- feat(docs): 补充地图回退策略与验收截图

## 3. 文档更新强制规则

### 3.1 路径规则

- 文档目录固定为 docs/YYYY-MM-DD/功能点.md
- 每个功能点一份文档，禁止把多个功能点混写在同一文件

### 3.2 单个功能文档模板

每个功能文档必须包含以下章节：

1) 功能目标
2) 变更范围
3) 关键实现
4) 配置项变更
5) 风险与回滚
6) 验收结果
7) 对应提交记录

## 4. Agent 角色配置建议

### 4.1 Architect Agent

职责：
- 拆分功能点
- 定义接口契约
- 维护验收标准
- 审核 Code Agent 输出是否符合蓝图

输入：
- 蓝图文档
- 当前里程碑目标
- 上一功能点的验收记录

输出：
- 下一功能点任务卡
- 验收清单
- 文档更新要求

### 4.2 Code Agent

职责：
- 实现单一功能点
- 补齐必要测试
- 更新功能文档
- 生成可审计提交记录

输入：
- 任务卡
- 接口契约
- 代码规范

输出：
- 代码变更
- docs 功能文档
- Git 提交与 push 记录

### 4.3 Debug Agent

职责：
- 复现与定位故障
- 输出根因分析
- 给出最小修复方案
- 更新故障处理文档

## 5. Skills 目录建议

建议建立 skills 文档索引，作为可复用操作手册。首批 Skills：

1) skill-itinerary-api
- FastAPI 新增接口
- Pydantic 校验
- 错误码对齐

2) skill-llm-gateway-failover
- Codex 5.4 主路由
- 硅基流动与 NVIDIA NIM 自动切换
- 超时与 5xx 故障回退

3) skill-expo-tab-feature
- Expo Router 新增页面
- 三 Tab 导航扩展
- 状态页与空态处理

4) skill-google-maps-deeplink
- Waypoints 组装
- iOS 与 Android 差异处理
- 失败回退复制链接

5) skill-doc-and-commit
- 生成 docs/YYYY-MM-DD/功能点.md
- 执行 feat(scope): 摘要 提交
- push 并登记提交号

## 6. Prompt 模板建议

### 6.1 实现类 Prompt 模板

你正在实现 HackTravel 的单一功能点。请严格遵守：
- 仅实现本功能点范围
- 保持与蓝图和接口契约一致
- 完成后必须更新 docs/YYYY-MM-DD/功能点.md
- 完成后必须执行一次 Git 提交并 push
- 提交信息格式 feat(scope): 摘要
- 输出变更文件清单、验收结果、提交号

### 6.2 修复类 Prompt 模板

你正在修复线上问题。请严格遵守：
- 先复现，再定位根因
- 采用最小改动修复
- 输出回归验证结果
- 更新 docs/YYYY-MM-DD/故障修复-功能点.md
- 提交并 push，提交信息 feat(scope): 修复摘要

## 7. 代码规范基线

### 7.1 通用规则

- 单次变更聚焦单一功能点
- 禁止混入无关重构
- 关键路径必须有错误处理与日志
- 对外接口必须可观测，需带 request_id

### 7.2 FastAPI 规则

- 请求与响应全部使用 Pydantic 模型
- 错误码使用蓝图定义前缀 HKT
- 外部调用必须设置超时与重试边界

### 7.3 Expo 规则

- 页面按路由文件组织
- 组件职责单一
- 空态、加载态、失败态必须显式实现

## 8. 每次功能完成后的必做清单

1) 代码与测试通过
2) 新增或更新 docs/YYYY-MM-DD/功能点.md
3) 自检验收清单打勾
4) Git 提交信息符合 feat(scope): 摘要
5) push 到 main
6) 在文档中登记提交号与变更文件

## 9. 提交流程样例

1) 完成 行程生成接口 功能
2) 新增文档：docs/2026-03-09/行程生成接口.md
3) 执行提交：feat(api): 新增行程生成接口
4) 执行 push
5) 在文档内补充 commit hash 与验收记录

## 10. 与蓝图的一致性约束

以下关键约束不得偏离：

- 匿名优先可用，登录入口默认关闭
- 模型主路由为 Codex 5.4
- 自动切换备路由为硅基流动和 NVIDIA NIM
- 主备全失败时回退缓存路线
- 首发必须包含三 Tab 与地图导入能力

本规范生效后，后续每个功能点开发都必须引用本文件执行。
# Architecture / 架构设计 — HackTravel

## 顶级模块

| 文件夹 | 职责 |
|--------|------|
| `backend/` | FastAPI BFF API 服务 |
| `backend/app/routes/` | 路由层：请求验证、调用 service、返回响应 |
| `backend/app/services/` | 业务逻辑层：行程生成、LLM 网关、社区、缓存 |
| `backend/app/models/` | Pydantic 请求/响应模型定义 |
| `backend/app/core/` | 配置、异常、中间件 |
| `backend/tests/` | pytest 测试 |
| `frontend/` | Expo + React Native + TypeScript 客户端 |
| `frontend/app/` | Expo Router 页面（文件系统路由） |
| `frontend/app/(tabs)/` | 三 Tab 页面：极限爆改、抄作业、盯盘 |
| `frontend/components/` | 共享 UI 组件 |
| `frontend/services/` | API 客户端、类型定义、预置数据 |
| `frontend/constants/` | 颜色、主题常量 |
| `docs/` | 项目文档 |
| `plans/` | 实施蓝图与执行计划 |
| `agents/` | Agent 角色定义（Architect / Code / Debug） |
| `skills/` | 可复用 Skill 定义 |

## 模块边界

| 关注点 | 所在位置 | 不应出现在 |
|--------|---------|-----------|
| API 路由 | `backend/app/routes/` | services、models |
| 业务逻辑 | `backend/app/services/` | routes、models |
| 数据模型 | `backend/app/models/` | routes（仅被 routes 引用） |
| LLM 调用 | `backend/app/services/llm_gateway.py` | routes、models |
| 配置 | `backend/app/core/config.py` | 分散在各模块中 |
| UI 展示 | `frontend/app/`, `frontend/components/` | services |
| API 调用 | `frontend/services/api.ts` | 组件中内联 |
| 类型定义 | `frontend/services/types.ts` | 散落各处 |

## 数据流

### 后端
```
HTTP 请求 → Route（Pydantic 验证）
  → Service（业务逻辑）
  → LLM Gateway / Cache Service / DB
  → Service（结果转换与归一化）
  → Route（返回 Pydantic 响应模型）
```

### 前端
```
用户交互 → Event Handler
  → API Service（fetch + 类型化响应）
  → 状态更新
  → 组件重渲染
  → UI 反映新状态（含加载态、空态、错误态）
```

## 关键约定

- **后端文件命名：** snake_case
- **前端文件命名：** camelCase（服务/工具），PascalCase（组件）
- **错误处理：** 后端统一异常处理 + `HKT` 错误码前缀；前端三态展示（加载/空/错误）
- **日志：** 后端所有日志含 `request_id`，结构化 JSON 输出
- **导出方式：** 前端命名导出优先
- **Pydantic 模型：** 请求用 `Request` 后缀，响应用 `Response` 后缀

## 测试策略

| 层级 | 测试内容 | 文件位置 | 工具 |
|------|---------|---------|------|
| 后端单元 | Services、模型验证 | `backend/tests/` | pytest |
| 后端 API | 路由端到端（TestClient） | `backend/tests/` | pytest + httpx |
| 前端单元 | 服务函数、工具函数 | `frontend/__tests__/` | jest |

## 依赖规则

- 后端依赖方向：routes → services → （LLM gateway / cache / DB）
- 前端依赖方向：pages → components → services
- 领域逻辑不得直接导入基础设施（DB、LLM）
- 共享代码放在专用模块中，不堆在 `utils` 里

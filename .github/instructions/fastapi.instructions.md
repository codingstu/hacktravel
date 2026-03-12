---
applyTo: "backend/**/*.py"
---

FastAPI 后端服务。完整工作流规则见 `AGENTS.md`。

- Routes（路由）：精简——通过 Pydantic 验证 → 调用 Service → 返回类型化响应。无业务逻辑。
- Services（服务）：纯逻辑，无 DB 或 HTTP 导入。
- Models（模型）：Pydantic 请求/响应边界模型。
- `async def` 仅用于 I/O 密集型工作（DB、HTTP、LLM 调用）。
- 所有路由返回显式 Pydantic 响应模型。
- 错误码前缀 `HKT`，日志含 `request_id`。
- LLM 调用走 `llm_gateway.py`，遵循主备切换策略。
- 变更后运行质量门控：ruff check → ruff format --check → pytest。
- 提交前使用 `AGENTS.md` §7 中的代码审查清单。

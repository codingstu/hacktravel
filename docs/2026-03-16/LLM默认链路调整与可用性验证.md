# LLM 默认链路调整与可用性验证

日期：2026-03-16

## 背景

根据运行策略调整，默认 LLM 链路需改为：

`gpt-5.2 -> minimax/minimax-m2.5:free -> grok-4.20-beta -> deepseek-ai/DeepSeek-V3.2 -> Qwen/Qwen3-8B`

并在落地前验证候选模型 ID 在当前网关账号下可用。

## 可用性验证

使用 `backend/.env` 中的网关地址与密钥，对三个网关执行 `GET /v1/models` 探测，匹配候选模型 ID：

- OpenAI ShowQR：命中 `gpt-5.2`、`minimax/minimax-m2.5:free`
- Grok ShowQR：命中 `grok-4.20-beta`
- SiliconFlow：命中 `deepseek-ai/DeepSeek-V3.2`、`Qwen/Qwen3-8B`

结论：目标链路中的 5 个模型 ID 均可用。

## 本次改动

1. 运行配置与模板同步
- `backend/.env`
- `backend/.env.example`
- `backend/.env.prod.example`

2. 后端默认值同步
- `backend/app/core/config.py`

3. 网关文档注释同步
- `backend/app/services/llm_gateway.py`

4. 测试同步
- `backend/tests/test_itinerary.py`
- provider chain 顺序断言更新为 5 段链路

5. 规格与决策文档同步
- `docs/spec.md`
- `docs/decisions.md`
- `plans/implementation-blueprint.md`
- `docs/plan.md`

## 验证结果

执行：

```bash
cd backend && /Users/ikun/study/Learning/HackTravel/.venv/bin/python -m pytest -q tests/test_itinerary.py
```

结果：

- `32 passed`

补充检查：

```bash
cd backend && /Users/ikun/study/Learning/HackTravel/.venv/bin/python -m ruff check app tests
```

结果：

- 存在仓库既有 lint 问题（非本次链路改动引入），本次未扩大修复范围。

## 风险与后续

- 当前 `LLM_TOTAL_TIMEOUT=30`，链路变长后，深层降级触发概率受总时长影响。
- 建议后续结合生产日志观察 provider 切换分布，必要时再做超时参数重分配。

# LLM 回退顺序修正与生产环境同步

日期：2026-03-15

## 背景

在 LLM 回退链调整中，出现了模型与网关归属不一致的问题：
- `https://grok.showqr.eu.cc/v1` 仅承载 grok 模型
- `MiniMax-M2.5` 与 `gpt-5.2` 属于 `https://openai.showqr.eu.cc/v1`

为避免错误路由导致的失败，本次对回退顺序进行校正并同步生产配置模板。

## 本次变更

1. 后端默认配置修正
- 文件：`backend/app/core/config.py`
- 主网关：
  - `LLM_PRIMARY_MODEL=grok-4.1-fast`
  - `LLM_PRIMARY_FALLBACK_MODELS=`
- 备份网关（OpenAI）：
  - `LLM_BACKUP1_MODEL=MiniMax-M2.5`
  - `LLM_BACKUP1_FALLBACK_MODELS=gpt-5.2`

2. 环境模板同步
- 文件：`backend/.env.example`
- 文件：`backend/.env.prod.example`
- 统一为：`grok-4.1-fast -> MiniMax-M2.5 -> gpt-5.2`

3. 网关说明注释更新
- 文件：`backend/app/services/llm_gateway.py`
- 更新降级链路注释，避免后续误读。

4. 测试补充
- 文件：`backend/tests/test_itinerary.py`
- 新增顺序断言测试，校验 provider chain 中：
  - `grok-4.1-fast` 后紧随 `MiniMax-M2.5`
  - 再后是 `gpt-5.2`

## 验证

执行：
- `cd backend && /Users/ikun/study/Learning/HackTravel/.venv/bin/python -m pytest -q tests/test_itinerary.py`

结果：
- `32 passed`

## 上线动作（VPS）

1. 更新 VPS 上 `backend/.env.prod`：
- `LLM_BACKUP1_MODEL=MiniMax-M2.5`
- `LLM_BACKUP1_FALLBACK_MODELS=gpt-5.2`

2. 重新部署：
- `docker compose -f docker-compose.prod.yml up -d --build`

3. 观察日志确认链路：
- `docker compose -f docker-compose.prod.yml logs -f --tail=200 api`

## 风险与回滚

- 风险：MiniMax 波动时会更快切到 gpt-5.2。
- 回滚：将 `LLM_BACKUP1_MODEL` 与 `LLM_BACKUP1_FALLBACK_MODELS` 互换后重启 `api` 服务。

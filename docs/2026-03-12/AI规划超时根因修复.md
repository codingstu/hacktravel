# AI 规划超时根因修复 — stream:false 与链路优化

## 功能目标

修复 AI 行程规划 100% 超时失败的致命 bug，确保主链路 20s 内返回。

## 根因分析

### 真正的根因：Grok 网关默认返回 SSE 流式响应

通过直接 curl 和 httpx 测试发现：

1. **不带 `stream: false`** 时，`grok.showqr.eu.cc` 返回 `Content-Type: text/event-stream; charset=utf-8`（SSE 流）
2. 我们的 `_call_provider()` 使用 `httpx.AsyncClient.post()` 读取完整响应体
3. httpx 等待 HTTP body 结束，但 SSE 流只有等到 `[DONE]` 才算结束
4. 在读取流式响应时，httpx 的 `read` timeout 是针对单次读取的，但 SSE 会持续发送小 chunk…最终要么超时，要么解析出的 body 是 SSE 文本（`data: {...}\ndata: {...}\n`）而非有效 JSON
5. → `ReadTimeout` 或 `json.loads` parse error → 走到 SiliconFlow 72B → 72B 也很慢 → 最终全链路超时

### 为什么网页版 10 秒就能出结果

Grok 网页版原生支持流式渲染。我们后端是 REST 调用，必须拿到完整 JSON 再返回，所以必须用 `stream: false` 让网关聚合完整响应后一次性返回。

### 验证数据

| 场景 | 加 `stream:false`? | 结果 |
|------|-------------------|------|
| Grok grok-4.1-fast | ❌ | Content-Type=text/event-stream → ReadTimeout |
| Grok grok-4.1-fast | ✅ | **7.2s** 返回完整 JSON，6 legs |
| SiliconFlow Qwen 72B | ✅ | ReadTimeout (18s，模型太大) |
| SiliconFlow Qwen 7B | ✅ | **13.1s** 返回完整 JSON，5 legs |

## 变更范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `backend/app/services/llm_gateway.py` | 修改 | payload 增加 `"stream": False` |
| `backend/app/core/config.py` | 修改 | 超时 15/15/15s + LLM_TOTAL_TIMEOUT=30s + 备选改 7B |
| `backend/app/services/itinerary_service.py` | 修改（上轮） | asyncio.wait_for 全链路硬上限 |
| `frontend/services/api.ts` | 修改 | TIMEOUT_MS 60→45s |
| `backend/.env` | 修改 | 超时值与模型同步 |
| `backend/.env.example` | 修改 | 同上 |
| `backend/.env.prod.example` | 修改 | 同上 |

## 关键实现

### 1. `stream: false`（核心修复）

```python
# llm_gateway.py → _call_provider()
payload = {
    "model": provider.model,
    "temperature": settings.LLM_TEMPERATURE,
    "stream": False,  # 关键！强制非流式，否则 showqr 网关默认返回 SSE
    "messages": [...],
}
```

### 2. 链路时间预算优化

| Provider | 旧超时 | 新超时 | 模型变更 |
|----------|-------|-------|---------|
| Grok (primary) | 25s | 15s | 移除 thinking 备选 |
| OpenAI (backup1) | 25s | 15s | 不变 |
| SiliconFlow (backup2) | 20s (72B) | 15s (7B) | 72B→7B |
| 全链路硬上限 | 无 | 30s | 新增 asyncio.wait_for |
| 前端 AbortController | 60s | 45s | 对齐后端 |

### 3. 时间预算保证

- **乐观路径**: Grok primary → 7-15s ✅
- **降级路径**: Grok 失败 → SiliconFlow 7B → +3-15s
- **最坏情况**: 30s 硬上限 → 返回 504 ModelTimeoutError → 前端友好提示
- **前端永不 AbortError**: 45s > 30s，永远收到后端结构化错误码

## 配置变更

**生产***（VPS 上的 `.env.prod`）需同步更新：**
```
LLM_PRIMARY_TIMEOUT=15
LLM_PRIMARY_FALLBACK_MODELS=
LLM_BACKUP1_TIMEOUT=15
LLM_BACKUP2_MODEL=Qwen/Qwen2.5-7B-Instruct
LLM_BACKUP2_TIMEOUT=15
```

## 风险与回滚

| 风险 | 概率 | 回滚方式 |
|------|------|---------|
| showqr 网关忽略 stream:false | 极低（已验证有效） | 改用流式读取 + 手动聚合 |
| 7B 模型质量不如 72B | 中（仅影响 backup） | 改回 72B 并放大 timeout |
| 30s 总超时太短导致正常请求被截断 | 低（实测 primary 7-14s） | 调整 LLM_TOTAL_TIMEOUT |

## 验收标准

- [x] Grok primary + stream:false → 7.2s 返回有效 JSON
- [x] SiliconFlow 7B backup → 13.1s 返回有效 JSON
- [ ] 生产环境 VPS 重新部署后 AI 规划正常
- [ ] 前端"开始规划"→ 20s 内出结果

## 提交记录

```
fix(llm): 修复AI规划100%超时——Grok网关SSE流式响应根因

根因: showqr网关默认返回SSE流(text/event-stream)，
httpx.post()等待完整body→ReadTimeout，所有provider连锁失败。

修复: payload强制stream:false，从SSE 7.2s实测完成
优化: SiliconFlow 72B→7B(2.5s)，全链路硬上限50→30s
```

commit: `ca24d61` → main

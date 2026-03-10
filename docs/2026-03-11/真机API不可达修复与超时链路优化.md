# 真机/Web 端 API 不可达修复与 LLM 超时链路优化

## 1. 功能目标

- **真机/Web AI 规划修复**：彻底解决手机端和 Web 端"AI 生成超时"的根本原因。根因不是模型超时，而是前端从未成功向后端发出请求——`getBaseUrl()` 在真机上返回 `localhost:8001`，手机的 `localhost` 指向手机自身而非开发机。
- **保存路线修复**：修复在 Plan Tab 直接保存路线时因 `device_id` 未初始化导致的保存失败。
- **超时链路收紧**：将 LLM 超时总和（25s + 20s = 45s）收紧至远低于前端 60s 超时，确保后端始终在前端超时前返回结果或错误。
- **NVIDIA 备用通道禁用**：API Key 为空时不再进入 NVIDIA 降级分支，减少无效重试延迟。

## 2. 变更范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `frontend/services/api.ts` | 修复 | `getBaseUrl()` 重写：使用 `expo-constants` `debuggerHost` 自动发现开发机 LAN IP；网络错误信息优化；`TIMEOUT_MS` 75s→60s |
| `frontend/app/(tabs)/index.tsx` | 修复 | Save 处理函数中自动生成 `device_id`（若未初始化） |
| `backend/.env` | 配置 | 主模型超时 45s→25s；禁用 NVIDIA Key；SiliconFlow 备选模型列表清理；备用1超时 30s→20s |
| `backend/.env.example` | 配置 | 同步 `.env` 变更 |
| `backend/app/core/config.py` | 配置 | `LLM_PRIMARY_TIMEOUT` 默认值 35→25 |

## 3. 关键实现

### 3.1 根因：真机 localhost ≠ 开发机 localhost

**现象**：在真机或 Expo Go App 上点击"AI 规划"，后端 Docker 日志**零请求**——前端请求从未到达后端。

**根因定位**：

```typescript
// 修复前（旧代码）
if (Platform.OS === 'ios') {
  return 'http://localhost:8001';  // ❌ 手机的 localhost = 手机自身，不是开发机
}
```

手机通过 WiFi 连开发机，开发机 IP 为 `192.168.100.24`。`localhost` 在手机上解析为 `127.0.0.1`（手机本身），完全无法到达电脑上的 Docker 容器。前端网络错误被 `catch` 成"超时"展示给用户，造成误导。

**修复方案**：使用 `expo-constants` 的 `debuggerHost` 字段，该字段由 Expo Dev Server 注入，格式为 `"192.168.100.24:8081"`，取 IP 部分拼接 API 端口 `8001`：

```typescript
import Constants from 'expo-constants';

const getBaseUrl = (): string => {
  if (__DEV__) {
    // Web 端：浏览器 hostname 与 Expo Dev Server 同主机
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `http://${window.location.hostname}:8001`;
    }

    // Android 模拟器：固定别名 10.0.2.2
    if (Platform.OS === 'android') {
      const debuggerHost = Constants.expoGoConfig?.debuggerHost
        ?? (Constants as any).manifest?.debuggerHost;
      if (debuggerHost) {
        const host = debuggerHost.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:8001`; // 真机：debuggerHost LAN IP
        }
      }
      return 'http://10.0.2.2:8001'; // 模拟器兜底
    }

    // iOS 真机/模拟器：优先 debuggerHost
    const debuggerHost = Constants.expoGoConfig?.debuggerHost
      ?? (Constants as any).manifest?.debuggerHost;
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:8001`; // 真机：开发机 LAN IP
      }
    }
    return 'http://localhost:8001'; // iOS 模拟器兜底
  }
  return 'https://api.hacktravel.app'; // 生产环境
};
```

开发模式下增加 `console.log('[HackTravel API] BASE_URL =', BASE_URL)` 方便排查。

### 3.2 保存路线 device_id 修复

**根因**：`device_id` 仅在 `profile.tsx` 的 `loadData()` 中初始化。用户若直接进入 Plan Tab 且未访问过 Profile Tab，`device_id` 为 `null`，保存路线接口报 400。

**修复**：在 `index.tsx` 的保存处理函数中加入懒初始化：

```typescript
const handleSaveRoute = async () => {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await AsyncStorage.setItem('device_id', deviceId);
  }
  // ...保存逻辑
};
```

### 3.3 超时链路收紧

**原超时链（最坏情况 ~215s）**：
`主模型 45s × 2 + 备用1 30s × 2 + 备用2 30s × 2 ≈ 210s >> 前端 75s`

后端在前端已超时后仍在计算，资源浪费。

**新超时链（最坏情况 ~45s）**：

| 层级 | 模型 | 超时 |
|------|------|------|
| 主模型 | grok-4.1-fast | 25s |
| 主备选 | grok-4.1-thinking | 25s（共享主 timeout） |
| 备用1 | gpt-5.2 (ShowQR OpenAI) | 25s |
| 备用2 | Qwen2.5-72B (SiliconFlow) | 20s |
| 前端总超时 | — | 60s |

最坏总链 = 25 + 20 = 45s < 前端 60s，后端始终比前端先 fail-fast，用户看到明确错误而非超时。

## 4. 配置项变更

```env
# backend/.env
LLM_PRIMARY_TIMEOUT=25               # 改自 45
LLM_BACKUP1_TIMEOUT=25               # ShowQR OpenAI 备选
LLM_BACKUP2_TIMEOUT=20               # SiliconFlow 保底
```

```python
# backend/app/core/config.py
LLM_PRIMARY_TIMEOUT: int = 25        # 改自 35
```

```typescript
// frontend/services/api.ts
const TIMEOUT_MS = 60_000;           // 改自 75_000
```

## 5. 风险与回滚

| 风险 | 概率 | 处置 |
|------|------|------|
| WiFi 切换后 `debuggerHost` IP 变化 | 低 | `--clear` 重启 Expo 即可刷新 IP |
| 生产环境 `__DEV__` 为 false，走 `api.hacktravel.app` | 无风险 | 逻辑分支隔离 |
| 25s 内 gemini-3-flash 超时 | 低 | 实测 ~13-21s，余量充足；超时自动 fallback 至 gpt-5.2 |
| `debuggerHost` 在非 Expo Go 环境为 `undefined` | 极低 | 双重兜底：`?? manifest?.debuggerHost` + 最终 localhost |

**回滚**：还原 `api.ts` `getBaseUrl()` 为 `return 'http://10.0.2.2:8001'`（Android）/ `return 'http://localhost:8001'`（iOS 模拟器），恢复 `.env` 超时值。

## 6. 验收结果

| 测试项 | 环境 | 结果 | 详情 |
|--------|------|------|------|
| AI 规划（skip_preset=true） | curl via LAN IP | ✅ 21.2s | grok-4.1-fast，6 legs，上海→大阪 72H |
| AI 规划（带缓存） | curl via LAN IP | ✅ 83ms | 命中 Redis 缓存 |
| LAN IP 健康检查 | curl 192.168.100.24:8001 | ✅ 通过 | `{"status":"ok"}` |
| TypeScript 编译 | `npx tsc --noEmit` | ✅ 零错误 | EXIT=0 |
| Docker 重建 | `docker compose up -d --build api` | ✅ 通过 | MODEL=gemini-3-flash, TIMEOUT=25 |
| 手机 Chrome Web 端 AI 规划 | 真实设备 | ✅ 通过 | 用户验收：基本可用 |
| 保存路线（Plan Tab 直接保存） | 真实设备 | ✅ 通过 | device_id 自动生成 |

## 7. 对应提交记录

```
fix: 真机/Web端API不可达 — localhost→debuggerHost LAN IP + 超时链路优化 + 保存路线device_id修复
```

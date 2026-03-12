# Decisions / 架构决策记录 — HackTravel

---

## 2026-03-09 — 选择 FastAPI 作为后端框架

**状态:** accepted

**背景:**
需要一个高性能的 Python API 框架，支持异步 I/O（LLM 调用、Redis 缓存），同时提供内置的请求验证能力。

**决策:**
使用 FastAPI + Pydantic 作为后端 BFF 层。

**影响:**
- 正面：自动 OpenAPI 文档、Pydantic 类型校验、原生 async 支持。
- 负面：团队需要熟悉 FastAPI 的依赖注入模式。

**备选方案:**
- Flask：生态成熟但异步支持差。
- Django REST：功能全但过重，不适合 BFF 场景。

---

## 2026-03-09 — 选择 Expo + React Native 作为前端框架

**状态:** accepted

**背景:**
需要一套代码同时覆盖 iOS、Android、Web 三端，且保证原生渲染（非 WebView 套壳）以通过商店审核。

**决策:**
使用 Expo + React Native + Expo Router 构建跨端应用。

**影响:**
- 正面：文件系统路由、一套代码三端、EAS 构建直出商店包。
- 负面：Expo Go 存在部分原生模块限制，需要 development build 解决。

**备选方案:**
- Flutter：跨端优秀但团队无 Dart 经验。
- PWA：Web 端体验好但原生端功能受限。

---

## 2026-03-09 — LLM 多供应商容灾策略

**状态:** accepted

**背景:**
单一 AI 模型（Codex 5.4）有超时和不可用风险，需要自动切换与兜底。

**决策:**
实现三级容灾：Codex 5.4 → 硅基流动 → NVIDIA NIM → 缓存路线。

**影响:**
- 正面：用户始终能得到行程结果（最差情况为缓存）。
- 负面：多供应商适配增加维护成本，prompt 需要跨模型兼容。

---

## 2026-03-09 — 匿名优先可用

**状态:** accepted

**背景:**
首期验证阶段不需要用户登录门槛，降低用户流失。

**决策:**
匿名优先可用，登录入口保留但默认关闭（`ENABLE_AUTH=false`）。所有功能匿名可访问。

**影响:**
- 正面：零门槛使用，利于早期验证和分享传播。
- 负面：无法做个性化推荐和用户数据持久化。

---

## 2026-03-12 — 集成 Stack Kit 工程规范

**状态:** accepted

**背景:**
项目需要标准化的 AI 辅助开发规范，统一 Claude Code、GitHub Copilot、Cursor 的行为。

**决策:**
基于 [codingstu/stack-kit](https://github.com/codingstu/stack-kit) 安装并定制 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursor/rules/`、`docs/` 骨架，合并现有 `agents/`、`skills/`、`prompts/` 目录。

**影响:**
- 正面：所有 AI 助手共享相同规范，减少幻觉和代码风格漂移。
- 负面：需要团队学习新的文档结构和工作流。

**备选方案:**
- 手工维护分散的指令文件：已证明易不一致。
- 完全不用规范：AI 输出质量不可控。

---

## 2026-03-13 — 地区自适应 Disclaimer 采用大洲+语言方案

**状态:** accepted

**背景:**
行程结果页需要地区感知的免责提示，推荐不同地区的主流购票平台。Grok 建议的方案依赖 Vercel Edge `x-vercel-ip-country` headers 做国家级检测，但 HackTravel 前端是 Expo/React Native SPA（Metro bundler），无 SSR，无 Edge Functions，该 header 不存在。

**决策:**
采用**大洲+语言双维度前端方案**（6 大洲 × 2 语种 = 12 条文案），复用现有 `region.ts` 大洲推断 + `i18n.ts` 语言检测。后端预留 `policy.disclaimer` 字段供 Phase 2 下发国家级精准文案。IP 地理定位 API 国家级检测作为 Phase 2 占位。

**影响:**
- 正面：零新依赖，零网络请求，立即可用。复用现有基础设施。
- 负面：粒度为大洲级而非国家级（如中国和日本同属 Asia 但推荐平台不同），通过 locale 区分 zh/en 部分缓解。

**备选方案:**
- Vercel Edge headers：HackTravel 非 SSR，不可用。
- IP Geolocation API（ipapi.co 等）：增加外部依赖、网络延迟、隐私成本、免费限额。作为 Phase 2 保留。
- 纯后端下发：需后端发版协调，Phase 1 前端方案更轻。

---

## 2026-03-13 — 对齐前后端 PolicyInfo 类型定义

**状态:** accepted

**背景:**
发现前后端 `PolicyInfo` 定义不一致：后端为 `is_user_generated: bool, can_share: bool`，前端为 `privacy_url: string, terms_url: string`。这是 M2 快速开发期遗留的契约 bug。

**决策:**
前端 `PolicyInfo` 对齐后端定义（`is_user_generated`, `can_share`），并在两端新增 `disclaimer?: string` 字段为 Phase 2 后端下发预留。

**影响:**
- 正面：消除前后端类型漂移，后续扩展有统一基础。
- 负面：前端之前未实际使用 `PolicyInfo` 的 `privacy_url`/`terms_url`（均为死字段），无实质影响。

---

## 2026-03-13 — 提取共享 UI 组件（Toast/TravelItemCard/SkeletonCard）

**状态:** accepted

**背景:**
代码审查发现 Toast 在 3 个页面重复实现、TimelineLeg 在 index.tsx 和 community.tsx 有两套不同实现、ACTIVITY_ICON_MAP 重复声明。index.tsx 已 2272 行（规范上限 200 行）。

**决策:**
提取为共享组件：`Toast.tsx`、`TravelItemCard.tsx`（含 full/compact 两种模式）、`SkeletonCard.tsx`、`DisclaimerBanner.tsx`，并将 `ACTIVITY_ICON_MAP` 移至 `constants/activityIcons.ts`。

**影响:**
- 正面：消除代码重复、统一 UI 表现、为后续拆分 index.tsx 奠定基础。
- 负面：引入新组件文件，但均在 80 行规范内。

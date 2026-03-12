---
applyTo: "frontend/**/*.ts,frontend/**/*.tsx"
---

Expo + React Native + TypeScript 跨端应用。完整工作流规则见 `AGENTS.md`。

- Expo Router 文件系统路由，三 Tab 在 `app/(tabs)/`。
- 保持渲染逻辑纯粹。副作用放在 hooks 或 `services/` 中。
- API 调用在 `services/api.ts`——永远不要内联在组件中。
- 本地状态优先。共享状态库需决策记录。
- 每个页面处理三态：加载态、空态、错误态。
- 首屏提供预置内容，避免空白。
- 复用或超过 80 行的组件，每个文件放一个组件。
- 变更后运行质量门控：tsc --noEmit → jest --runInBand。
- 提交前使用 `AGENTS.md` §7 中的代码审查清单。

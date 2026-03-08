# UI v3 深度重构 — 「潮旅杂志」设计系统

> 日期：2026-03-09
> 提交：UI-deep-redesign

## 1. 重构目标

用户反馈当前 UI **AI 味过重**（emoji 堆砌、通用模板感、排版单调），要求：
- 去 AI 味 — 让页面看起来像人类设计师手工打磨
- 吸引用户 — 第一眼抓住注意力
- 观感舒适 — 不刺眼、阅读顺畅、有呼吸感

## 2. 设计语言：「潮旅杂志」

| 维度 | 旧版 | 新版 |
|------|------|------|
| 色彩 | 纯橙 `#FF6B35` + 冷灰底 `#F5F6FA` | 珊瑚橘 `#E8653A` + 奶油白 `#FAF8F5` — 更高级温暖 |
| 排版 | 均匀 16px 间距，标题/正文对比弱 | 大标题 hero 34px + 多级字重 + 负 letter-spacing |
| 图标 | emoji 做标题（🔥📋📡🍜🚌） | Ionicons 实色/线框一致，活动类型带色块圆点 |
| 卡片 | 白卡 + 细描边 | 去描边，用统一 Shadow 层级（sm/md/lg） |
| 色条 | 无 | 社区卡片左侧 4px accent strip |
| 加载文案 | "🤖 特种兵规划师正在疯狂排兵布阵..." | 随机个性文案池（5 条），斜体显示 |
| Tab Bar | 通用底边框 | 无边框 + 浮起投影 + 选中态圆形高亮底 |

## 3. 变更文件清单

| 文件 | 变更摘要 |
|------|---------|
| `frontend/constants/Theme.ts` | 全新设计系统：Colors（渐变/暗底/暖底）、Spacing（加大 xl/hero）、FontSize（新增 hero 34px）、FontWeight、Shadow 工具函数 |
| `frontend/app/(tabs)/_layout.tsx` | Tab Bar 去 emoji headerTitle、浮起投影、选中态 icon 圆底 |
| `frontend/app/(tabs)/index.tsx` | Hero 大标题「去哪儿穷游爆改？」、表单用 FROM/TO 标签、时长预算组合行、时间轴用彩色 icon 圆点替代 emoji、随机加载文案 |
| `frontend/app/(tabs)/community.tsx` | 卡片左侧 accent strip、去 emoji 标题、迷你时间轴用彩色 icon 圆点 |
| `frontend/app/(tabs)/watchlist.tsx` | 2×2 功能卡片网格替代竖列、精简雷达动画参数、去 emoji 隐私说明 |

## 4. 验证结果

```
✅ npx expo export --platform web — 成功
   9 routes, 2.3MB bundle
   0 TypeScript errors
```

## 5. 设计决策备忘

- **为什么用珊瑚橘而非纯橙？** 纯橙 `#FF6B35` 在大面积使用时视觉侵略性强，珊瑚橘 `#E8653A` 饱和度更低，长时间阅读更舒适
- **为什么去掉 emoji 标题？** emoji 在不同平台渲染差异大，且大量使用会让界面看起来像 AI 自动生成
- **为什么用 `Shadow.colored()`？** 主 CTA 按钮带同色投影能增加「可点击感」，比通用灰色投影更有设计感
- **为什么 Tab 选中态加圆底？** 视觉锚点更明确，且是 iOS/Android 原生设计趋势（与 Material You 一致）

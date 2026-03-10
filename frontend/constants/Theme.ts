/**
 * HackTravel 设计系统 v8 — 「Stitch 统一」风格
 *
 * 视觉目标（对齐 Google Stitch 设计稿）：
 * - 主色 #2e5c49 深林绿，搭配 #f6f7f7 冷灰白背景
 * - Inter 字体 · 10px 大写标签 · 极轻透明度边框
 * - 全局 rounded-xl(24) 卡片 · rounded-full pill 芯片
 * - 极简投影 + backdrop-blur 顶栏 + 底栏
 */
export const Colors = {
  // ── 主色 ── 对齐 Stitch #2e5c49
  primary: '#2e5c49',
  primaryLight: '#E8F0EC',
  primaryDark: '#1E3F33',
  accent: '#FFFFFF',

  // ── 基底 ── 冷灰白
  secondary: '#161c1a',
  secondaryLight: '#1E2D26',
  background: '#f6f7f7',
  surface: '#FFFFFF',
  surfaceElevated: '#F9FAFA',

  // ── 文字 ── slate 色阶
  text: '#0f172a',          // slate-900
  textSecondary: '#64748b', // slate-500
  textLight: '#94a3b8',     // slate-400
  textOnDark: '#cbd5e1',    // slate-300
  textOnPrimary: '#FFFFFF',

  // ── 功能色 ──
  border: '#2e5c4912',      // primary/7%
  divider: '#2e5c490A',     // primary/4%
  success: '#16a34a',
  warning: '#f97316',
  error: '#ef4444',

  // ── 时间轴 ──
  timeline: '#2e5c49',
  timelineFaded: '#2e5c4930',

  // ── 标签 ──
  tag: {
    bg: '#e2e8f0',          // slate-200
    text: '#64748b',        // slate-500
    border: '#e2e8f0',
  },
  tagActive: {
    bg: '#2e5c4918',        // primary/10%
    text: '#2e5c49',
    border: '#2e5c4930',    // primary/20%
  },

  // ── 状态色 ──
  status: {
    progressBg: '#fff7ed',
    progressText: '#ea580c',
    liveBg: '#2e5c4918',
    liveText: '#2e5c49',
  },

  // ── Tab Bar ──
  tab: {
    active: '#2e5c49',
    inactive: '#94a3b8',
    bg: '#FFFFFFE8',        // white/95 blur
    border: '#2e5c490A',
  },

  // ── 渐变 ──
  gradient: {
    heroStart: '#2e5c49',
    heroEnd: '#1E3F33',
    ctaStart: '#2e5c49',
    ctaEnd: '#1E3F33',
    warmStart: '#f6f7f7',
    warmEnd: '#e2e8f0',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  hero: 56,
};

export const FontSize = {
  /** 10px — Stitch uppercase labels */
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 26,
  hero: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,     // Stitch rounded-lg = 1rem
  xl: 24,     // Stitch rounded-xl = 1.5rem
  full: 999,
};

/**
 * 统一投影 — 极轻 Stitch 风格
 */
export const Shadow = {
  sm: {
    shadowColor: '#0f172a08',
    shadowOpacity: 1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a10',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lg: {
    shadowColor: '#0f172a18',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  }),
};

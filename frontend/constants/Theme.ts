/**
 * HackTravel 设计系统 v6 — 「轻物流卡片」风格
 *
 * 视觉目标：
 * - 大面积柔和雾蓝背景，阅读舒适不刺眼
 * - 高圆角卡片 + 轻投影，建立明确层级
 * - 统一状态色与标签胶囊，提升“系统感”
 */
export const Colors = {
  // ── 主色 ──
  primary: '#2D6CDF',
  primaryLight: '#EAF1FF',
  primaryDark: '#1F4FB2',
  accent: '#FFFFFF',

  // ── 基底 ──
  secondary: '#10243F',
  secondaryLight: '#1B3A5F',
  background: '#EAF0F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FDFEFF',

  // ── 文字 ──
  text: '#10243F',
  textSecondary: '#4E627B',
  textLight: '#90A2B7',
  textOnDark: '#DFE7F2',
  textOnPrimary: '#FFFFFF',

  // ── 功能色 ──
  border: '#D9E3EF',
  divider: '#E8EEF5',
  success: '#1F9A68',
  warning: '#F0A34B',
  error: '#DF5757',

  // ── 时间轴 ──
  timeline: '#3A79D7',
  timelineFaded: '#D8E5FA',

  // ── 标签 ──
  tag: {
    bg: '#F2F6FB',
    text: '#4E627B',
    border: '#D9E3EF',
  },
  tagActive: {
    bg: '#EAF1FF',
    text: '#2D6CDF',
    border: '#2D6CDF',
  },

  // ── 状态色 ──
  status: {
    progressBg: '#FFF2E4',
    progressText: '#BE6A1E',
    liveBg: '#EAF8F1',
    liveText: '#1F9A68',
  },

  // ── Tab Bar ──
  tab: {
    active: '#2D6CDF',
    inactive: '#92A4B8',
    bg: '#FFFFFF',
    border: '#D9E3EF',
  },

  // ── 渐变 ──
  gradient: {
    heroStart: '#90A4B5',
    heroEnd: '#AABBC8',
    ctaStart: '#2D6CDF',
    ctaEnd: '#1F5AC9',
    warmStart: '#FFFFFF',
    warmEnd: '#F1F5FA',
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
  hero: 64,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 34,
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
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

/**
 * 统一投影 — 替代行内散写的 shadow 属性
 */
export const Shadow = {
  sm: {
    shadowColor: '#10243F12',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#10243F1A',
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#10243F22',
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  }),
};

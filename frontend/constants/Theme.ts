/**
 * HackTravel 设计系统 v3 — 「潮旅杂志」风格
 *
 * 设计原则：
 * 1. 去 AI 味 — 不使用 emoji 做版块标题，用纯排版 + 留白 + 色块建立层次
 * 2. 杂志感排版 — 大号标题 + 显著对比 + 不对称留白
 * 3. 色彩有性格 — 珊瑚橘 × 暗墨蓝 × 奶油白，温暖但不幼稚
 * 4. 玻璃质感 — 卡片带微妙投影 + 浅磨砂背景
 */
export const Colors = {
  // ── 主色 ──
  primary: '#E8653A',       // 珊瑚橘 — 比纯橙更高级
  primaryLight: '#FFF0EB',  // 橘色浅底
  primaryDark: '#C9512A',   // 按压态
  accent: '#FFB347',        // 暖金点缀

  // ── 基底 ──
  secondary: '#0F1923',     // 暗墨蓝
  secondaryLight: '#1C2D3F', // 稍亮墨蓝 — 卡片内
  background: '#FAF8F5',    // 奶油白
  surface: '#FFFFFF',
  surfaceElevated: '#FFFEFB', // 略偏暖的提升卡片

  // ── 文字 ──
  text: '#1A1D21',          // 近黑
  textSecondary: '#5A6068', // 更温暖的灰
  textLight: '#A0A7B0',     // 占位符 / 次次级
  textOnDark: '#E8ECF0',    // 暗底上的浅字

  // ── 功能色 ──
  border: '#ECEAE6',        // 暖灰分割
  divider: '#F0EDE9',
  success: '#2ABF6E',
  warning: '#F0A020',
  error: '#E04848',

  // ── 时间轴 ──
  timeline: '#E8653A',
  timelineFaded: '#E8653A22',

  // ── 标签 ──
  tag: {
    bg: '#FFF0EB',
    text: '#D05530',
    border: '#F5D0C0',
  },

  // ── Tab Bar ──
  tab: {
    active: '#E8653A',
    inactive: '#B0B5BC',
    bg: '#FFFEFB',
    border: '#F0EDE9',
  },

  // ── 渐变：用于 Header / Hero ──
  gradient: {
    heroStart: '#0F1923',
    heroEnd: '#1A3040',
    ctaStart: '#E8653A',
    ctaEnd: '#D04A2A',
    warmStart: '#FFFAF5',
    warmEnd: '#FAF8F5',
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
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

/**
 * 统一投影 — 替代行内散写的 shadow 属性
 */
export const Shadow = {
  sm: {
    shadowColor: '#1A1D2110',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#1A1D2118',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A1D2120',
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
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

/**
 * HackTravel 设计系统 v5 — 「商业级蓝白现代」风格 (Premium Commercial)
 *
 * 设计原则与用户心理：
 * 1. 极致信任感：使用经典商务蓝为核心品牌色，缓解用户的认知焦虑，建立对应用的信任。
 * 2. 视觉友好：抛弃刺眼的荧光绿与沉闷的暗色杂交，统一为大面积清爽留白＋高级深邃的对比色。
 * 3. 商业落地感（Airbnb / Stripe)：文字、投影与间距全面贴合主流顶尖应用的沉浸式体验。
 */
export const Colors = {
  // ── 主色 ── (商业级湛蓝)
  primary: '#2563EB',       // Blue 600 - 高级商业首选颜色，信任感强
  primaryLight: '#EFF6FF',  // Blue 50 - 清透的浅蓝底色
  primaryDark: '#1D4ED8',   // Blue 700 - 操作态深蓝
  accent: '#FFFFFF',        // 反色：用于主色/带颜色背景上的纯白图标与字体

  // ── 基底 ──
  secondary: '#0F172A',     // Slate 900 - 极沉稳的黑蓝，用于高端黑卡、摘要
  secondaryLight: '#1E293B',// Slate 800 - 深色区域边框与提升层
  background: '#F8FAFC',    // Slate 50 - 比纯白稍微柔和的冷灰底，减少眼部疲劳
  surface: '#FFFFFF',       // 纯白表单与组件底
  surfaceElevated: '#FFFFFF', 

  // ── 文字 ──
  text: '#0F172A',          // 极深色，主文字
  textSecondary: '#475569', // Slate 600 - 优秀的次级阅读色
  textLight: '#94A3B8',     // Slate 400 - 输入框占位符
  textOnDark: '#F8FAFC',    // 暗色卡片上的辅助文字色
  textOnPrimary: '#FFFFFF', // 主色块上的文字（强制对比白）

  // ── 功能色 ──
  border: '#E2E8F0',        // 极淡的高级分割线 (Slate 200)
  divider: '#F1F5F9',       // Slate 100
  success: '#10B981',       // 统一标准的绿 (Emerald 500)
  warning: '#F59E0B',       // Amber 500
  error: '#EF4444',         // Red 500

  // ── 时间轴 ──
  timeline: '#2563EB',      // 蓝色主轴
  timelineFaded: '#DBEAFE', // 轨道浅色底

  // ── 标签 ──
  tag: {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#E2E8F0',
  },
  tagActive: {
    bg: '#EFF6FF',
    text: '#2563EB',
    border: '#2563EB',
  },

  // ── Tab Bar ──
  tab: {
    active: '#2563EB',
    inactive: '#94A3B8',
    bg: '#FFFFFF',
    border: '#E2E8F0',
  },

  // ── 渐变：用于 Header / Hero (商业极简避免过度渐变) ──
  gradient: {
    heroStart: '#2563EB',
    heroEnd: '#1D4ED8',
    ctaStart: '#2563EB',
    ctaEnd: '#2563EB',
    warmStart: '#FFFFFF',
    warmEnd: '#F8FAFC',
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

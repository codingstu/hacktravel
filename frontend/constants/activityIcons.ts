/**
 * activityIcons — 活动类型 → Ionicons 图标 + 颜色映射
 *
 * 抽离自 index.tsx / community.tsx 重复定义，统一维护。
 */

export const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

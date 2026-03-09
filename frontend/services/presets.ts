/**
 * 预设热门路线 – 确保首屏不空
 * 蓝图要求：冷启动期展示 2-3 条热门预设路线
 */
import { CommunityRoute } from './types';

export const PRESET_ROUTES: CommunityRoute[] = [
  {
    id: 'preset-okinawa-48h',
    title: '48H 怒刷冲绳，人均 ¥2800 极限挑战',
    destination: '冲绳',
    total_hours: 48,
    budget: { amount: 2800, currency: 'CNY' },
    copy_count: 328,
    tags: ['疯狂暴走', '极限吃货'],
    summary: {
      total_hours: 48,
      estimated_total_cost: { amount: 2800, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-03-15T08:00:00',
        end_time_local: '2026-03-15T11:00:00',
        activity_type: 'flight',
        place: { name: '那霸机场', latitude: 26.1958, longitude: 127.6459 },
        transport: { mode: 'flight', reference: '春秋航空 9C6218' },
        estimated_cost: { amount: 800, currency: 'CNY' },
        tips: ['提前 2 周订票最便宜', '随身 7kg 行李够了'],
      },
      {
        index: 1,
        start_time_local: '2026-03-15T11:30:00',
        end_time_local: '2026-03-15T12:30:00',
        activity_type: 'food',
        place: { name: '牧志公设市场', latitude: 26.2144, longitude: 127.6868 },
        transport: { mode: 'bus', reference: '那霸单轨 → 牧志站' },
        estimated_cost: { amount: 80, currency: 'CNY' },
        tips: ['二楼加工海鲜才 500 日元', '龙虾刺身性价比爆炸'],
      },
      {
        index: 2,
        start_time_local: '2026-03-15T13:00:00',
        end_time_local: '2026-03-15T15:00:00',
        activity_type: 'attraction',
        place: { name: '首里城', latitude: 26.2172, longitude: 127.7195 },
        transport: { mode: 'walk' },
        estimated_cost: { amount: 30, currency: 'CNY' },
        tips: ['门票 400 日元', '日落前去拍照最佳'],
      },
      {
        index: 3,
        start_time_local: '2026-03-15T15:30:00',
        end_time_local: '2026-03-15T18:00:00',
        activity_type: 'shopping',
        place: { name: '国际通', latitude: 26.2148, longitude: 127.6832 },
        transport: { mode: 'walk' },
        estimated_cost: { amount: 200, currency: 'CNY' },
        tips: ['药妆店比大陆便宜 40%', '盐屋冰淇淋必尝'],
      },
    ],
  },
  {
    id: 'preset-hcm-48h',
    title: '48H 怒刷胡志明市，人均 ¥350 挑战',
    destination: '胡志明市',
    total_hours: 48,
    budget: { amount: 350, currency: 'CNY' },
    copy_count: 512,
    tags: ['穷鬼免税店', '极限吃货'],
    summary: {
      total_hours: 48,
      estimated_total_cost: { amount: 350, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-03-20T06:00:00',
        end_time_local: '2026-03-20T08:00:00',
        activity_type: 'flight',
        place: { name: '新山一国际机场', latitude: 10.8189, longitude: 106.6519 },
        transport: { mode: 'flight', reference: 'VietJet VJ886' },
        estimated_cost: { amount: 150, currency: 'CNY' },
        tips: ['越捷航空大促常有 0 元机票', '只带背包省行李费'],
      },
      {
        index: 1,
        start_time_local: '2026-03-20T08:30:00',
        end_time_local: '2026-03-20T09:30:00',
        activity_type: 'food',
        place: { name: 'Phở Hòa Pasteur', latitude: 10.7769, longitude: 106.6896 },
        transport: { mode: 'bus', reference: '109 路公交 → 市中心' },
        estimated_cost: { amount: 15, currency: 'CNY' },
        tips: ['当地人最爱的牛肉粉', '大份才 60k 越南盾'],
      },
      {
        index: 2,
        start_time_local: '2026-03-20T10:00:00',
        end_time_local: '2026-03-20T12:00:00',
        activity_type: 'attraction',
        place: { name: '统一宫', latitude: 10.7769, longitude: 106.6955 },
        transport: { mode: 'walk' },
        estimated_cost: { amount: 10, currency: 'CNY' },
        tips: ['门票 40k 越南盾', '了解越战历史必去'],
      },
      {
        index: 3,
        start_time_local: '2026-03-20T12:30:00',
        end_time_local: '2026-03-20T14:00:00',
        activity_type: 'food',
        place: { name: '滨城市场', latitude: 10.7721, longitude: 106.6990 },
        transport: { mode: 'walk' },
        estimated_cost: { amount: 20, currency: 'CNY' },
        tips: ['法棍 10k 很好吃', '砍价到一半开始'],
      },
    ],
  },
  {
    id: 'preset-bangkok-24h',
    title: '曼谷 24H 极限吃货路线，¥200 封顶',
    destination: '曼谷',
    total_hours: 24,
    budget: { amount: 200, currency: 'CNY' },
    copy_count: 267,
    tags: ['极限吃货', '打卡狂魔'],
    summary: {
      total_hours: 24,
      estimated_total_cost: { amount: 200, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-04-01T07:00:00',
        end_time_local: '2026-04-01T08:00:00',
        activity_type: 'food',
        place: { name: '胜利纪念碑船面', latitude: 13.7650, longitude: 100.5388 },
        transport: { mode: 'metro', reference: 'BTS 胜利纪念碑站' },
        estimated_cost: { amount: 8, currency: 'CNY' },
        tips: ['一碗才 40 泰铢', '当地人排队那家最好'],
      },
      {
        index: 1,
        start_time_local: '2026-04-01T08:30:00',
        end_time_local: '2026-04-01T10:30:00',
        activity_type: 'attraction',
        place: { name: '大皇宫', latitude: 13.7500, longitude: 100.4913 },
        transport: { mode: 'bus', reference: '公交船 → Tha Chang' },
        estimated_cost: { amount: 35, currency: 'CNY' },
        tips: ['门票 500 泰铢', '穿长裤长裙否则进不去'],
      },
      {
        index: 2,
        start_time_local: '2026-04-01T11:00:00',
        end_time_local: '2026-04-01T12:30:00',
        activity_type: 'food',
        place: { name: 'Jay Fai', latitude: 13.7554, longitude: 100.5054 },
        transport: { mode: 'walk' },
        estimated_cost: { amount: 60, currency: 'CNY' },
        tips: ['米其林一星路边摊', '蟹肉蛋卷必点'],
      },
    ],
  },
];

/** 可用的特种兵标签 */
export const TRAVEL_TAGS = [
  { key: '疯狂暴走', emoji: '🏃' },
  { key: '极限吃货', emoji: '🍜' },
  { key: '穷鬼免税店', emoji: '🛍️' },
  { key: '打卡狂魔', emoji: '📸' },
] as const;

/** 热门目的地快捷选项 — 与后端 preset_routes.py 同步 */
export const HOT_DESTINATIONS = [
  '冲绳', '胡志明市', '曼谷', '新加坡', '清迈',
  '吉隆坡', '岘港', '东京', '大阪', '首尔',
  '巴厘岛', '香港', '台北', '澳门', '京都',
] as const;

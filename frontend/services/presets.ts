/**
 * 全球预设热门路线与区域元数据
 * 作为后端 `/v1/itineraries/regions` 的前端回退数据与首屏展示数据
 */
import type { CommunityRoute, Continent, FeaturedSubRegion, RegionMeta } from './types';

export const PRESET_ROUTES: CommunityRoute[] = [
  {
    id: 'preset-okinawa-24h',
    title: '冲绳 24H 海风快闪，¥1800 暴走版',
    destination: '冲绳',
    continent: 'Asia',
    sub_region: 'EastAsia',
    total_hours: 24,
    budget: { amount: 1800, currency: 'CNY' },
    copy_count: 328,
    tags: ['海岛躺平', '极限吃货'],
    summary: {
      total_hours: 24,
      estimated_total_cost: { amount: 1800, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-03-15T09:00:00',
        end_time_local: '2026-03-15T10:30:00',
        activity_type: 'food',
        place: { name: '泊港渔市场', latitude: 26.2253, longitude: 127.6739 },
        transport: { mode: 'taxi' },
        estimated_cost: { amount: 60, currency: 'CNY' },
        tips: ['早上海鲜饭最新鲜'],
      },
    ],
  },
  {
    id: 'preset-bangkok-24h',
    title: '曼谷 24H 极限吃货路线，¥200 封顶',
    destination: '曼谷',
    continent: 'Asia',
    sub_region: 'SoutheastAsia',
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
        place: { name: '胜利纪念碑船面', latitude: 13.765, longitude: 100.5388 },
        transport: { mode: 'metro', reference: 'BTS 胜利纪念碑站' },
        estimated_cost: { amount: 8, currency: 'CNY' },
        tips: ['一碗才 40 泰铢'],
      },
    ],
  },
  {
    id: 'preset-london-24h',
    title: '伦敦 24H 王炸打卡，¥2200 快闪版',
    destination: '伦敦',
    continent: 'Europe',
    sub_region: 'UK',
    total_hours: 24,
    budget: { amount: 2200, currency: 'CNY' },
    copy_count: 188,
    tags: ['打卡狂魔', '博物馆'],
    summary: {
      total_hours: 24,
      estimated_total_cost: { amount: 2200, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-07-01T08:00:00',
        end_time_local: '2026-07-01T10:00:00',
        activity_type: 'attraction',
        place: { name: '白金汉宫', latitude: 51.5014, longitude: -0.1419 },
        transport: { mode: 'metro' },
        estimated_cost: { amount: 0, currency: 'CNY' },
        tips: ['换岗仪式看时间'],
      },
    ],
  },
  {
    id: 'preset-paris-48h',
    title: '巴黎 48H 城市光影巡礼，¥3200 经典版',
    destination: '巴黎',
    continent: 'Europe',
    sub_region: 'ContinentalEurope',
    total_hours: 48,
    budget: { amount: 3200, currency: 'CNY' },
    copy_count: 221,
    tags: ['浪漫打卡', '博物馆'],
    summary: {
      total_hours: 48,
      estimated_total_cost: { amount: 3200, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-08-01T09:00:00',
        end_time_local: '2026-08-01T12:00:00',
        activity_type: 'attraction',
        place: { name: '卢浮宫', latitude: 48.8606, longitude: 2.3376 },
        transport: { mode: 'metro' },
        estimated_cost: { amount: 180, currency: 'CNY' },
        tips: ['提前预约省排队'],
      },
    ],
  },
  {
    id: 'preset-rio-48h',
    title: '里约 48H 山海缆车双修，¥3000 进阶版',
    destination: '里约热内卢',
    continent: 'SouthAmerica',
    sub_region: 'LatinAmerica',
    total_hours: 48,
    budget: { amount: 3000, currency: 'CNY' },
    copy_count: 145,
    tags: ['山海全收', '缆车体验'],
    summary: {
      total_hours: 48,
      estimated_total_cost: { amount: 3000, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-09-02T09:00:00',
        end_time_local: '2026-09-02T12:00:00',
        activity_type: 'attraction',
        place: { name: '面包山', latitude: -22.9486, longitude: -43.1566 },
        transport: { mode: 'taxi' },
        estimated_cost: { amount: 220, currency: 'CNY' },
        tips: ['日落推荐'],
      },
    ],
  },
  {
    id: 'preset-cairo-24h',
    title: '开罗 24H 金字塔快闪，¥2000 核心版',
    destination: '开罗',
    continent: 'Africa',
    sub_region: 'NorthAfrica',
    total_hours: 24,
    budget: { amount: 2000, currency: 'CNY' },
    copy_count: 132,
    tags: ['古迹控', '金字塔'],
    summary: {
      total_hours: 24,
      estimated_total_cost: { amount: 2000, currency: 'CNY' },
    },
    legs: [
      {
        index: 0,
        start_time_local: '2026-10-01T08:00:00',
        end_time_local: '2026-10-01T12:00:00',
        activity_type: 'attraction',
        place: { name: '吉萨金字塔', latitude: 29.9792, longitude: 31.1342 },
        transport: { mode: 'taxi' },
        estimated_cost: { amount: 220, currency: 'CNY' },
        tips: ['建议早去避晒'],
      },
    ],
  },
];

export const TRAVEL_TAGS = [
  { key: '疯狂暴走', emoji: '🏃' },
  { key: '极限吃货', emoji: '🍜' },
  { key: '穷鬼免税店', emoji: '🛍️' },
  { key: '打卡狂魔', emoji: '📸' },
] as const;

export const CONTINENT_OPTIONS: Array<{ key: Continent; label: string }> = [
  { key: 'Asia', label: '亚洲' },
  { key: 'Europe', label: '欧洲' },
  { key: 'Africa', label: '非洲' },
  { key: 'NorthAmerica', label: '北美' },
  { key: 'SouthAmerica', label: '南美' },
  { key: 'Oceania', label: '大洋洲' },
] as const;

export const FEATURED_SUB_REGIONS_FALLBACK: FeaturedSubRegion[] = [
  { key: 'EastAsia', label: '东亚', preset_count: 6, hot_destinations: ['冲绳', '东京', '大阪', '首尔', '台北', '福冈'] },
  { key: 'SoutheastAsia', label: '东南亚', preset_count: 7, hot_destinations: ['曼谷', '清迈', '新加坡', '普吉岛', '槟城', '巴厘岛'] },
  { key: 'ContinentalEurope', label: '欧洲大陆', preset_count: 4, hot_destinations: ['巴黎', '罗马', '巴塞罗那', '阿姆斯特丹'] },
  { key: 'UK', label: '英国', preset_count: 5, hot_destinations: ['伦敦', '爱丁堡', '曼彻斯特', '利物浦'] },
  { key: 'LatinAmerica', label: '拉丁美洲', preset_count: 6, hot_destinations: ['里约热内卢', '圣保罗', '布宜诺斯艾利斯', '利马', '圣地亚哥'] },
  { key: 'NorthAfrica', label: '北非', preset_count: 3, hot_destinations: ['开罗', '马拉喀什'] },
  { key: 'SubSaharanAfrica', label: '撒哈拉以南非洲', preset_count: 3, hot_destinations: ['开普敦', '内罗毕', '桑给巴尔'] },
];

export const REGION_METADATA_FALLBACK: RegionMeta[] = [
  {
    key: 'Asia',
    label: '亚洲',
    preset_count: 13,
    hot_destinations: ['冲绳', '东京', '大阪', '首尔', '台北', '曼谷', '清迈', '新加坡', '普吉岛', '槟城', '巴厘岛', '胡志明市'],
    sub_regions: [
      { key: 'EastAsia', label: '东亚', preset_count: 6 },
      { key: 'SoutheastAsia', label: '东南亚', preset_count: 7 },
    ],
  },
  {
    key: 'Europe',
    label: '欧洲',
    preset_count: 9,
    hot_destinations: ['伦敦', '爱丁堡', '曼彻斯特', '利物浦', '巴黎', '罗马', '巴塞罗那', '阿姆斯特丹'],
    sub_regions: [
      { key: 'UK', label: '英国', preset_count: 5 },
      { key: 'ContinentalEurope', label: '欧洲大陆', preset_count: 4 },
    ],
  },
  {
    key: 'Africa',
    label: '非洲',
    preset_count: 6,
    hot_destinations: ['开罗', '马拉喀什', '开普敦', '内罗毕', '桑给巴尔'],
    sub_regions: [
      { key: 'NorthAfrica', label: '北非', preset_count: 3 },
      { key: 'SubSaharanAfrica', label: '撒哈拉以南非洲', preset_count: 3 },
    ],
  },
  {
    key: 'NorthAmerica',
    label: '北美',
    preset_count: 2,
    hot_destinations: ['纽约', '洛杉矶'],
    sub_regions: [{ key: 'NorthAmericaCore', label: '北美核心', preset_count: 2 }],
  },
  {
    key: 'SouthAmerica',
    label: '南美',
    preset_count: 6,
    hot_destinations: ['里约热内卢', '圣保罗', '布宜诺斯艾利斯', '利马', '圣地亚哥'],
    sub_regions: [{ key: 'LatinAmerica', label: '拉丁美洲', preset_count: 6 }],
  },
  {
    key: 'Oceania',
    label: '大洋洲',
    preset_count: 2,
    hot_destinations: ['悉尼', '墨尔本'],
    sub_regions: [{ key: 'OceaniaCore', label: '大洋洲', preset_count: 2 }],
  },
];

export const HOT_DESTINATIONS = PRESET_ROUTES.map(route => route.destination) as string[];

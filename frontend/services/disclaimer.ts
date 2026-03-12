/**
 * HackTravel 地区自适应 Disclaimer 文案映射
 *
 * 按大洲 + 语种（zh/en）提供免责提示，推荐各地区最主流购票平台。
 * 检测依赖现有 region.ts（大洲推断）和 i18n.ts（语言检测）。
 *
 * Phase 2 预留：后端通过 policy.disclaimer 下发国家级精准文案时，
 * 前端优先使用后端值，此本地映射作为 fallback。
 */
import type { Continent } from './types';
import type { Locale } from './i18n';

interface LocalizedDisclaimer {
  zh: string;
  en: string;
}

const DISCLAIMER_BY_CONTINENT: Record<Continent, LocalizedDisclaimer> = {
  Asia: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际交通、酒店、门票价格以携程、去哪儿、飞猪、Trip.com 为准，实时价格可能有较大浮动。',
    en: 'This itinerary is AI-generated for inspiration only. Verify real-time prices on Trip.com, Klook, Agoda, or Google Flights.',
  },
  Europe: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际价格请参考 Google Flights、Booking.com、Skyscanner、Trainline。',
    en: 'This itinerary is AI-generated for inspiration only. Check real prices on Google Flights, Booking.com, Skyscanner, or Trainline.',
  },
  NorthAmerica: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际价格请参考 Google Flights、Expedia、Kayak、Booking.com。',
    en: 'This itinerary is AI-generated for inspiration only. Verify prices on Google Flights, Expedia, Kayak, or Booking.com.',
  },
  SouthAmerica: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际价格请参考 Decolar、Booking.com、Google Flights。',
    en: 'This itinerary is AI-generated for inspiration only. Check real prices on Decolar, Booking.com, or Google Flights.',
  },
  Africa: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际价格请参考 Google Flights、Booking.com、Jumia Travel。',
    en: 'This itinerary is AI-generated for inspiration only. Verify prices on Google Flights, Booking.com, or Jumia Travel.',
  },
  Oceania: {
    zh: '此路线由 AI 生成，仅供灵感参考。实际价格请参考 Webjet、Flight Centre、Booking.com、Google Flights。',
    en: 'This itinerary is AI-generated for inspiration only. Check real prices on Webjet, Flight Centre, Booking.com, or Google Flights.',
  },
};

const FALLBACK_DISCLAIMER: LocalizedDisclaimer = {
  zh: '此路线由 AI 生成，仅供灵感参考。实际价格请在当地或国际订票平台上核实。',
  en: 'This itinerary is AI-generated for inspiration only. Prices are estimates — please verify on local or international booking platforms.',
};

/**
 * 获取地区自适应 disclaimer 文案。
 *
 * @param continent 用户选择 / 推断的大洲
 * @param locale    当前语言
 * @param serverDisclaimer 后端 policy.disclaimer 值（优先使用）
 */
export function getDisclaimer(
  continent: Continent | undefined,
  locale: Locale,
  serverDisclaimer?: string,
): string {
  if (serverDisclaimer) return serverDisclaimer;
  const entry = continent
    ? (DISCLAIMER_BY_CONTINENT[continent] ?? FALLBACK_DISCLAIMER)
    : FALLBACK_DISCLAIMER;
  return locale === 'zh' ? entry.zh : entry.en;
}

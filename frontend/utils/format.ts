/**
 * 格式化工具 — 货币、时区等通用格式化
 */
import type { Money } from '@/services/types';

/** 币种 → 符号映射 */
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  JPY: '¥',
  THB: '฿',
  VND: '₫',
  MYR: 'RM',
  SGD: 'S$',
  KRW: '₩',
  TWD: 'NT$',
  HKD: 'HK$',
  IDR: 'Rp',
};

/** 币种 → 中文名 */
const CURRENCY_LABEL: Record<string, string> = {
  CNY: '人民币',
  USD: '美元',
  JPY: '日元',
  THB: '泰铢',
  VND: '越南盾',
  MYR: '林吉特',
  SGD: '新币',
  KRW: '韩元',
  TWD: '台币',
  HKD: '港币',
  IDR: '印尼盾',
};

/**
 * 格式化金额显示
 * - CNY → ¥350
 * - THB → ฿200
 * - 若 showCode=true → ¥350 CNY
 */
export function formatMoney(money: Money, showCode = false): string {
  const sym = CURRENCY_SYMBOL[money.currency] ?? money.currency;
  const base = `${sym}${money.amount}`;
  return showCode ? `${base} ${money.currency}` : base;
}

/**
 * 格式化金额，始终带币种标识
 * ¥350 CNY / ฿200 THB
 */
export function formatMoneyWithCode(money: Money): string {
  return formatMoney(money, true);
}

/**
 * 获取币种中文名
 */
export function getCurrencyLabel(currency: string): string {
  return CURRENCY_LABEL[currency] ?? currency;
}

/** 目的地 → IANA 时区映射（覆盖预置路线的 15 个目的地） */
const DEST_TIMEZONE: Record<string, string> = {
  冲绳: 'Asia/Tokyo',
  东京: 'Asia/Tokyo',
  大阪: 'Asia/Tokyo',
  京都: 'Asia/Tokyo',
  曼谷: 'Asia/Bangkok',
  胡志明市: 'Asia/Ho_Chi_Minh',
  新加坡: 'Asia/Singapore',
  清迈: 'Asia/Bangkok',
  吉隆坡: 'Asia/Kuala_Lumpur',
  首尔: 'Asia/Seoul',
  巴厘岛: 'Asia/Makassar',
  岘港: 'Asia/Ho_Chi_Minh',
  香港: 'Asia/Hong_Kong',
  台北: 'Asia/Taipei',
  澳门: 'Asia/Macau',
};

/** UTC 偏移量简写：Asia/Tokyo → UTC+9 */
const TZ_UTC_OFFSET: Record<string, string> = {
  'Asia/Tokyo': 'UTC+9',
  'Asia/Bangkok': 'UTC+7',
  'Asia/Ho_Chi_Minh': 'UTC+7',
  'Asia/Singapore': 'UTC+8',
  'Asia/Kuala_Lumpur': 'UTC+8',
  'Asia/Seoul': 'UTC+9',
  'Asia/Makassar': 'UTC+8',
  'Asia/Hong_Kong': 'UTC+8',
  'Asia/Taipei': 'UTC+8',
  'Asia/Macau': 'UTC+8',
  'Asia/Shanghai': 'UTC+8',
};

/**
 * 获取目的地时区标注
 * @returns 如 "当地时间 UTC+9" 或 null（同为 UTC+8 不需标注）
 */
export function getTimezoneLabel(destination: string): string | null {
  const tz = DEST_TIMEZONE[destination];
  if (!tz) return null;
  const offset = TZ_UTC_OFFSET[tz];
  if (!offset) return null;
  // 如果与中国 UTC+8 相同，不标注
  if (offset === 'UTC+8') return null;
  return `当地时间 ${offset}`;
}

/**
 * 获取目的地时区 UTC 偏移
 */
export function getTimezoneOffset(destination: string): string | null {
  const tz = DEST_TIMEZONE[destination];
  if (!tz) return null;
  return TZ_UTC_OFFSET[tz] ?? null;
}

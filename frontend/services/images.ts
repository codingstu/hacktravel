/**
 * 目的地封面图片映射 — 使用 Unsplash CDN 高清旅行图
 *
 * 用法：
 *   import { getDestinationImage, HERO_IMAGE } from '@/services/images';
 *   <Image source={{ uri: getDestinationImage('冲绳', 800, 400) }} />
 *
 * 所有图片均来自 Unsplash（免费可商用），按 destination 精准匹配；
 * 未命中的 fallback 到一组通用旅行图。
 */

/* ── Unsplash Photo ID 映射 ── */
const DESTINATION_PHOTOS: Record<string, string> = {
  // 东亚
  冲绳: 'photo-1542640244-7e672d6cef4e',   // Okinawa sea
  东京: 'photo-1540959733332-eab4deabeeaf',   // Tokyo tower night
  大阪: 'photo-1590559899731-a382839e5549',   // Osaka castle
  首尔: 'photo-1534274988757-a28bf1a57c17',   // Seoul cityscape
  台北: 'photo-1470004914212-05527e49370b',   // Taipei 101
  福冈: 'photo-1524413840807-0c3cb6fa808d',   // Japanese temple
  京都: 'photo-1493976040374-85c8e12f0c0e',   // Kyoto bamboo forest
  北海道: 'photo-1551641506-ee5bf4cb45f1',     // Snow landscape
  北京: 'photo-1508804185872-d7badad00f7d',   // Great Wall
  上海: 'photo-1537531383496-f4749e0e1e29',   // Shanghai skyline
  香港: 'photo-1536599018102-9f803c140fc1',   // Hong Kong harbor

  // 东南亚
  曼谷: 'photo-1508009603885-50cf7c579365',   // Bangkok temples
  清迈: 'photo-1569931727762-fbb1fdd48dd1',   // Chiang Mai temple
  新加坡: 'photo-1525625293386-3f8f99389edd',   // Marina Bay
  普吉岛: 'photo-1589394815804-964ed0be2eb5',   // Phuket beach
  巴厘岛: 'photo-1537996194471-e657df975ab4',   // Bali rice terraces
  槟城: 'photo-1596422846543-75c6fc197f11',   // Penang street art
  胡志明市: 'photo-1583417319070-4a69db38a482', // Ho Chi Minh streets
  岘港: 'photo-1559592413-7cec4d0cae2b',       // Da Nang dragon bridge
  吉隆坡: 'photo-1596422846543-75c6fc197f11',   // Petronas towers
  河内: 'photo-1583417319070-4a69db38a482',     // Hanoi old quarter
  雅加达: 'photo-1555899434-94d1368aa7af',       // Jakarta cityscape
  马尼拉: 'photo-1518509562904-e7ef99cdcc86',   // Manila sunset
  宿务: 'photo-1507525428034-b723cf961d3e',     // Cebu beach
  札幌: 'photo-1551641506-ee5bf4cb45f1',         // Sapporo snow
  釜山: 'photo-1534274988757-a28bf1a57c17',     // Busan coast
  澳门: 'photo-1536599018102-9f803c140fc1',     // Macau ruins

  // 欧洲
  巴黎: 'photo-1502602898657-3e91760cbb34',   // Eiffel Tower
  伦敦: 'photo-1513635269975-59663e0ac1ad',   // London Big Ben
  罗马: 'photo-1552832230-c0197dd311b5',       // Rome Colosseum
  巴塞罗那: 'photo-1583422409516-2895a77efded', // Sagrada Familia
  阿姆斯特丹: 'photo-1534351590666-13e3e96b5017', // Amsterdam canals
  爱丁堡: 'photo-1506377585622-bedcbb027afc',   // Edinburgh castle
  曼彻斯特: 'photo-1515859005217-8a1f08870f59', // Manchester
  利物浦: 'photo-1560179304-6fc1f20e0768',     // Liverpool dock
  柏林: 'photo-1560969184-10fe8719e047',         // Berlin wall
  里斯本: 'photo-1548707309-dcebeab426c8',       // Lisbon tram
  布拉格: 'photo-1519677100203-a0e668c92439',   // Prague bridge
  维也纳: 'photo-1516550893923-42d28e5677af',   // Vienna palace

  // 美洲
  纽约: 'photo-1496442226666-8d4d0e62e6e9',   // NYC skyline
  洛杉矶: 'photo-1534190760961-74e8c1c5c3da', // LA beach
  里约热内卢: 'photo-1483729558449-99ef09a8c325', // Rio Christ
  圣保罗: 'photo-1543059080-ceca7a4c9083',     // São Paulo
  布宜诺斯艾利斯: 'photo-1589909202802-8f4aadce1849', // Buenos Aires
  利马: 'photo-1531968455001-5c5272a67c71',     // Lima coast
  圣地亚哥: 'photo-1510253687831-0f982beed98e', // Santiago mountain
  温哥华: 'photo-1559511260-66a68e7e1e5b',     // Vancouver harbor
  墨西哥城: 'photo-1518659526054-190340b32735', // Mexico City
  波哥大: 'photo-1598971457999-ca4ef48a9a71',   // Bogota
  卡塔赫纳: 'photo-1580618672591-eb180b1a973f', // Cartagena color streets

  // 非洲 & 中东
  开罗: 'photo-1572252009286-268acec5ca0a',   // Pyramids
  马拉喀什: 'photo-1489749798305-4fea3ae63d43', // Marrakech medina
  开普敦: 'photo-1580060839134-75a5edca2e99',   // Cape Town
  内罗毕: 'photo-1611348524140-53c9a25263d6',   // Nairobi giraffe
  桑给巴尔: 'photo-1547471080-7cc2caa01a7e',   // Zanzibar beach

  // 大洋洲
  悉尼: 'photo-1506973035872-a4ec16b8e8d9',   // Sydney Opera
  墨尔本: 'photo-1545044846-351ba102b6d5',     // Melbourne street

  // 常用英文名映射
  Okinawa: 'photo-1542640244-7e672d6cef4e',
  Tokyo: 'photo-1540959733332-eab4deabeeaf',
  Osaka: 'photo-1590559899731-a382839e5549',
  Seoul: 'photo-1534274988757-a28bf1a57c17',
  Taipei: 'photo-1470004914212-05527e49370b',
  Bangkok: 'photo-1508009603885-50cf7c579365',
  Singapore: 'photo-1525625293386-3f8f99389edd',
  Bali: 'photo-1537996194471-e657df975ab4',
  Paris: 'photo-1502602898657-3e91760cbb34',
  London: 'photo-1513635269975-59663e0ac1ad',
  Rome: 'photo-1552832230-c0197dd311b5',
  Barcelona: 'photo-1583422409516-2895a77efded',
  Amsterdam: 'photo-1534351590666-13e3e96b5017',
  'New York': 'photo-1496442226666-8d4d0e62e6e9',
  'Los Angeles': 'photo-1534190760961-74e8c1c5c3da',
  Rio: 'photo-1483729558449-99ef09a8c325',
  Cairo: 'photo-1572252009286-268acec5ca0a',
  Sydney: 'photo-1506973035872-a4ec16b8e8d9',
  Melbourne: 'photo-1545044846-351ba102b6d5',
  Dubai: 'photo-1512453979798-5ea266f8880c',
  Istanbul: 'photo-1524231757912-21f4fe3a7200',
  'Ho Chi Minh': 'photo-1583417319070-4a69db38a482',
  'Kuala Lumpur': 'photo-1596422846543-75c6fc197f11',
};

/** 通用旅行图片 fallback 池 */
const FALLBACK_PHOTOS = [
  'photo-1488646953014-85cb44e25828', // airplane window
  'photo-1507525428034-b723cf961d3e', // tropical beach
  'photo-1476514525535-07fb3b4ae5f1', // mountain lake
  'photo-1469854523086-cc02fe5d8800', // road trip
  'photo-1530789253388-582c481c54b0', // travel map
  'photo-1501785888041-af3ef285b470', // scenic valley
  'photo-1528127269322-539152af5929', // hot air balloons
  'photo-1504150558240-0b4fd8946624', // aurora borealis
  'photo-1500835556837-99ac94a94552', // airplane above clouds
  'photo-1436491865332-7a61a109db05', // compass & map
];

/** Hero 卡片主图 — 宽幅旅行风景 */
export const HERO_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=400&fit=crop&auto=format&q=80';

/** 结果汇总卡背景 — 深色航拍 */
export const RESULT_CARD_BG = 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&h=300&fit=crop&auto=format&q=80';

/**
 * 根据目的地名称获取封面图片 URL
 * @param destination 城市名（中文或英文均可）
 * @param w 图片宽度（px）
 * @param h 图片高度（px）
 */
export function getDestinationImage(destination: string, w = 600, h = 300): string {
  // 精确匹配
  const photoId = DESTINATION_PHOTOS[destination];
  if (photoId) {
    return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
  }
  // 模糊匹配：检查目的地名是否包含某个 key
  for (const [key, id] of Object.entries(DESTINATION_PHOTOS)) {
    if (destination.includes(key) || key.includes(destination)) {
      return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
    }
  }
  // Fallback：按名称 hash 从池中选一张
  const hash = [...destination].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const fallbackId = FALLBACK_PHOTOS[hash % FALLBACK_PHOTOS.length];
  return `https://images.unsplash.com/${fallbackId}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

/**
 * 根据活动类型获取装饰图
 */
const ACTIVITY_PHOTOS: Record<string, string> = {
  food: 'photo-1414235077428-338989a2e8c0',      // restaurant
  attraction: 'photo-1469474968028-56623f02e42e', // scenic
  shopping: 'photo-1441986300917-64674bd600d8',   // shopping
  transit: 'photo-1474487548417-781cb71495f3',    // train
  rest: 'photo-1551882547-ff40c63fe5fa',          // hotel
  flight: 'photo-1436491865332-7a61a109db05',     // airplane
};

export function getActivityImage(type: string, w = 400, h = 200): string {
  const id = ACTIVITY_PHOTOS[type] || FALLBACK_PHOTOS[0];
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

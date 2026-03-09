/**
 * HackTravel API 类型定义 – 与后端 Pydantic models 一一对应
 */
 
export type Currency = 'CNY' | 'USD' | 'JPY' | 'THB' | 'VND' | 'MYR' | 'SGD';

export type Continent =
  | 'Asia'
  | 'Europe'
  | 'Africa'
  | 'NorthAmerica'
  | 'SouthAmerica'
  | 'Oceania';

export type ActivityType =
  | 'food'
  | 'transit'
  | 'attraction'
  | 'rest'
  | 'shopping'
  | 'flight';

export type TransportMode =
  | 'walk'
  | 'bus'
  | 'metro'
  | 'taxi'
  | 'flight'
  | 'ferry'
  | 'train'
  | 'grab';

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Place {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface Transport {
  mode: TransportMode;
  reference?: string;
}

export interface ItineraryLeg {
  index: number;
  start_time_local: string;
  end_time_local: string;
  activity_type: ActivityType;
  place: Place;
  transport?: Transport;
  estimated_cost: Money;
  tips?: string[];
}

export interface ItinerarySummary {
  total_hours: number;
  estimated_total_cost: Money;
}

export interface MapInfo {
  google_maps_deeplink: string;
  waypoints_count: number;
}

export interface SourceInfo {
  llm_provider: string;
  model_name: string;
  cache_hit: boolean;
  is_preset?: boolean;
}

export interface PolicyInfo {
  privacy_url: string;
  terms_url: string;
}

export interface ItineraryGenerateRequest {
  origin: string;
  destination: string;
  total_hours: number;
  budget: Money;
  tags?: string[];
  locale?: string;
  timezone?: string;
  continent?: Continent;
  sub_region?: string;
  idempotency_key?: string;
  /** 强制跳过预置路线，直接调用 AI 生成（用于"重新规划"） */
  skip_preset?: boolean;
}

export interface ItineraryGenerateResponse {
  itinerary_id: string;
  title: string;
  summary: ItinerarySummary;
  legs: ItineraryLeg[];
  map: MapInfo;
  source: SourceInfo;
  policy?: PolicyInfo;
}

export interface ErrorResponse {
  error_code: string;
  message: string;
  detail?: string;
  retry_after?: number;
}

export interface RegionSubRegion {
  key: string;
  label: string;
  preset_count: number;
}

export interface RegionMeta {
  key: Continent;
  label: string;
  preset_count: number;
  hot_destinations: string[];
  sub_regions: RegionSubRegion[];
}

export interface FeaturedSubRegion {
  key: string;
  label: string;
  preset_count: number;
  hot_destinations: string[];
}

export interface RegionMetadataResponse {
  default_continent: Continent;
  continents: RegionMeta[];
  featured_sub_regions: FeaturedSubRegion[];
}

/** Tab2 社区路线卡片 */
export interface CommunityRoute {
  id: string;
  title: string;
  destination: string;
  continent?: Continent;
  sub_region?: string;
  total_hours: number;
  budget: Money;
  cover_image?: string;
  copy_count: number;
  tags: string[];
  legs: ItineraryLeg[];
  summary: ItinerarySummary;
  map?: MapInfo;
}

/** Tab2 社区路线列表响应 */
export interface CommunityRoutesListResponse {
  routes: CommunityRouteCard[];
  total: number;
  page: number;
  page_size: number;
}

/** Tab2 社区路线卡片（列表用，无 legs） */
export interface CommunityRouteCard {
  id: string;
  title: string;
  destination: string;
  total_hours: number;
  budget: Money;
  cover_image?: string;
  copy_count: number;
  tags: string[];
  summary: ItinerarySummary;
}

/** Tab2 复制路线响应 */
export interface CopyRouteResponse {
  success: boolean;
  copy_count: number;
  route: CommunityRoute;
}

/** Tab3 邮箱提交请求 */
export interface LeadEmailRequest {
  email: string;
  device_fingerprint?: string;
}

/** Tab3 邮箱提交响应 */
export interface LeadEmailResponse {
  success: boolean;
  message: string;
  is_duplicate: boolean;
}

/** Tab3 订阅统计响应 */
export interface LeadStatsResponse {
  total_subscribers: number;
  message: string;
}

/** 地点详情响应 */
export interface PlaceDetailResponse {
  name: string;
  description: string;
  image_url: string | null;
  wiki_url: string | null;
  map_url: string | null;
}

/** Tab3 价格监控请求 */
export interface PriceAlertRequest {
  origin: string;
  destination: string;
  max_price: number;
  email: string;
}

/** Tab3 价格监控响应 */
export interface PriceAlertResponse {
  success: boolean;
  alert_id: string;
  message: string;
}

/** Tab3 价格监控条目 */
export interface PriceAlertItem {
  alert_id: string;
  origin: string;
  destination: string;
  max_price: number;
  email: string;
  created_at: string;
  status: string;
}

/** Tab3 价格监控列表响应 */
export interface PriceAlertListResponse {
  alerts: PriceAlertItem[];
  total: number;
}

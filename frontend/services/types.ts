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
  is_user_generated: boolean;
  can_share: boolean;
  /** 地区感知免责提示，后端下发时优先使用；为空时前端 fallback 本地映射 */
  disclaimer?: string;
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

// ── Tab4 Profile 用户中心 ──

/** 用户资料 */
export interface UserProfile {
  device_id: string;
  name: string;
  tagline: string;
  avatar_url: string | null;
  email: string | null;
  countries_visited: number;
}

/** 用户资料响应 */
export interface UserProfileResponse {
  profile: UserProfile;
  is_new: boolean;
}

/** 用户资料更新请求 */
export interface UserProfileUpdateRequest {
  device_id: string;
  name?: string;
  tagline?: string;
  avatar_url?: string;
  email?: string;
  countries_visited?: number;
}

/** 用户统计 */
export interface UserStats {
  trips: number;
  saved: number;
  reviews: number;
}

/** 用户统计响应 */
export interface UserStatsResponse {
  stats: UserStats;
  device_id: string;
}

/** 用户偏好 */
export interface UserPreferences {
  dark_mode: boolean;
  language: string;
  currency: string;
}

/** 用户偏好响应 */
export interface UserPreferencesResponse {
  success: boolean;
  preferences: UserPreferences;
}

/** 用户偏好更新请求 */
export interface UserPreferencesRequest {
  device_id: string;
  dark_mode?: boolean;
  language?: string;
  currency?: string;
}

/** 已保存行程 */
export interface SavedItinerary {
  itinerary_id: string;
  title: string;
  destination: string;
  stops: number;
  days: number;
  cover_image: string | null;
  saved_at: string;
}

/** 已保存行程列表响应 */
export interface SavedItinerariesResponse {
  itineraries: SavedItinerary[];
  total: number;
}

/** 保存行程请求 */
export interface SaveItineraryRequest {
  device_id: string;
  itinerary_id: string;
  title: string;
  destination: string;
  stops?: number;
  days?: number;
  cover_image?: string;
}

/** 保存行程响应 */
export interface SaveItineraryResponse {
  success: boolean;
  message: string;
  itinerary_id: string;
}

/** 删除行程响应 */
export interface DeleteItineraryResponse {
  success: boolean;
  message: string;
}

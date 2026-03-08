/**
 * HackTravel API 类型定义 – 与后端 Pydantic models 一一对应
 */

export type Currency = 'CNY' | 'USD' | 'JPY' | 'THB' | 'VND' | 'MYR' | 'SGD';

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
  idempotency_key?: string;
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
}

/** Tab2 社区路线卡片 */
export interface CommunityRoute {
  id: string;
  title: string;
  destination: string;
  total_hours: number;
  budget: Money;
  cover_image?: string;
  copy_count: number;
  tags: string[];
  legs: ItineraryLeg[];
  summary: ItinerarySummary;
  map?: MapInfo;
}

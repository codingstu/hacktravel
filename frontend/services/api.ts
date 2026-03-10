/**
 * HackTravel API Client
 * 对接后端 FastAPI 服务
 */
import { Platform } from 'react-native';
import {
  ItineraryGenerateRequest,
  ItineraryGenerateResponse,
  ErrorResponse,
  CommunityRoutesListResponse,
  CommunityRoute,
  CopyRouteResponse,
  LeadEmailRequest,
  LeadEmailResponse,
  LeadStatsResponse,
  PlaceDetailResponse,
  PriceAlertRequest,
  PriceAlertResponse,
  PriceAlertListResponse,
  RegionMetadataResponse,
} from './types';

// 开发环境下 Android 模拟器用 10.0.2.2，iOS/Web 用 localhost
const getBaseUrl = (): string => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8001';
    }
    return 'http://localhost:8001';
  }
  // TODO: 生产环境 URL
  return 'https://api.hacktravel.app';
};

const BASE_URL = getBaseUrl();
const TIMEOUT_MS = 75_000; // 留足时间给后端降级链（单模型35s × 2次尝试 = 70s < 75s）

class ApiError extends Error {
  code: string;
  detail?: string;
  retryAfter?: number;

  constructor(resp: ErrorResponse) {
    super(resp.message);
    this.code = resp.error_code;
    this.detail = resp.detail;
    this.retryAfter = resp.retry_after;
    this.name = 'ApiError';
  }
}

/**
 * 解析后端错误响应体
 * FastAPI HTTPException 将自定义 detail 包裹在 {"detail": {...}} 中
 * 同时兼容直接返回 {error_code, message} 的格式
 */
function parseErrorResponse(data: unknown): ErrorResponse {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    // FastAPI 标准格式: {"detail": {"error_code": ..., "message": ...}}
    if (d.detail && typeof d.detail === 'object') {
      const inner = d.detail as Record<string, unknown>;
      if (typeof inner.error_code === 'string') {
        return {
          error_code: inner.error_code,
          message: typeof inner.message === 'string' ? inner.message : 'Unknown error',
          detail: typeof inner.request_id === 'string' ? inner.request_id : undefined,
          retry_after: typeof inner.retry_after === 'number' ? inner.retry_after : undefined,
        };
      }
    }
    // 直接格式: {"error_code": ..., "message": ...}
    if (typeof d.error_code === 'string') {
      return d as unknown as ErrorResponse;
    }
  }
  return { error_code: 'HKT_UNKNOWN', message: 'Unknown error' };
}

/**
 * 生成唯一幂等键
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 生成行程
 */
export async function generateItinerary(
  params: Omit<ItineraryGenerateRequest, 'idempotency_key'>,
): Promise<ItineraryGenerateResponse> {
  const body: ItineraryGenerateRequest = {
    ...params,
    locale: params.locale ?? 'zh-CN',
    timezone: params.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    idempotency_key: generateIdempotencyKey(),
  };

  const response = await fetchWithTimeout(`${BASE_URL}/v1/itineraries/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }

  return data as ItineraryGenerateResponse;
}

/**
 * 读取区域元数据（大洲、重点子区域、热门目的地）
 */
export async function fetchRegionMetadata(): Promise<RegionMetadataResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/itineraries/regions`,
    { method: 'GET' },
    8_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }

  return data as RegionMetadataResponse;
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/health`,
      { method: 'GET' },
      5000,
    );
    return response.ok;
  } catch {
    return false;
  }
}

export { ApiError, BASE_URL };

// ── Community Routes API (Tab2 抄作业) ────────────────────

/**
 * 获取社区精选路线列表
 */
export async function fetchCommunityRoutes(params?: {
  page?: number;
  page_size?: number;
  destination?: string;
  tag?: string;
}): Promise<CommunityRoutesListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.destination) searchParams.set('destination', params.destination);
  if (params?.tag) searchParams.set('tag', params.tag);

  const qs = searchParams.toString();
  const url = `${BASE_URL}/v1/community/routes${qs ? `?${qs}` : ''}`;

  const response = await fetchWithTimeout(url, { method: 'GET' }, 10_000);
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as CommunityRoutesListResponse;
}

/**
 * 获取单条社区路线详情（含 legs + map）
 */
export async function fetchCommunityRouteDetail(
  routeId: string,
): Promise<CommunityRoute> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/community/routes/${encodeURIComponent(routeId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as CommunityRoute;
}

/**
 * "我也要抄" — 计数 +1，返回完整路线
 */
export async function copyRoute(routeId: string): Promise<CopyRouteResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/community/routes/${encodeURIComponent(routeId)}/copy`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as CopyRouteResponse;
}

// ── Leads API (Tab3 盯盘) ─────────────────────────────────

/**
 * 提交邮箱订阅
 */
export async function submitLeadEmail(
  body: LeadEmailRequest,
): Promise<LeadEmailResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/leads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as LeadEmailResponse;
}

/**
 * 获取订阅统计
 */
export async function fetchLeadStats(): Promise<LeadStatsResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/leads/stats`,
    { method: 'GET' },
    5_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as LeadStatsResponse;
}

// ── Places API (地点详情) ─────────────────────────────────

/**
 * 获取地点详情（Wikipedia 摘要 + 图片 + 地图链接）
 */
export async function fetchPlaceDetail(params: {
  name: string;
  latitude?: number;
  longitude?: number;
}): Promise<PlaceDetailResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('name', params.name);
  if (params.latitude != null) searchParams.set('latitude', String(params.latitude));
  if (params.longitude != null) searchParams.set('longitude', String(params.longitude));

  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/places/detail?${searchParams.toString()}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as PlaceDetailResponse;
}

// ── Watchlist / Price Alert API (Tab3 盯盘) ───────────────

/**
 * 创建价格监控提醒
 */
export async function createPriceAlert(
  body: PriceAlertRequest,
): Promise<PriceAlertResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/watchlist/alerts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as PriceAlertResponse;
}

/**
 * 查询价格监控列表
 */
export async function fetchPriceAlerts(
  email: string,
): Promise<PriceAlertListResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/watchlist/alerts?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as PriceAlertListResponse;
}

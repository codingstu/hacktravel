/**
 * HackTravel API Client
 * 对接后端 FastAPI 服务
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  ScanStatusResponse,
  RegionMetadataResponse,
  UserProfileResponse,
  UserProfileUpdateRequest,
  UserStatsResponse,
  UserPreferencesResponse,
  UserPreferencesRequest,
  SavedItinerariesResponse,
  SavedItineraryDetailResponse,
  SaveItineraryRequest,
  SaveItineraryResponse,
  DeleteItineraryResponse,
  RegisterRequest,
  LoginRequest,
  SocialLoginRequest,
  SendCodeRequest,
  AuthResponse,
  SendCodeResponse,
  AIUsageResponse,
} from './types';

/**
 * 获取后端 API 基地址
 *
 * 开发环境策略：
 * - Web: 使用浏览器 hostname（与 Expo dev server 同一主机）
 * - Android 模拟器: 10.0.2.2（模拟器到宿主机的固定别名）
 * - 真机 (iOS/Android via Expo Go): 从 Expo debuggerHost 提取开发机 IP
 *   debuggerHost 格式: "192.168.x.x:8081"，我们取 IP 部分拼 API 端口
 * - 兜底: localhost（仅在 iOS 模拟器上有效）
 */
const getBaseUrl = (): string => {
  if (__DEV__) {
    // Web 端：直接用当前页面的 hostname
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const host = window.location.hostname;
      return `http://${host}:8001`;
    }

    // Android 模拟器专用
    if (Platform.OS === 'android') {
      // 先尝试从 Expo debuggerHost 获取真实 IP（适用于真机）
      const debuggerHost =
        Constants.expoGoConfig?.debuggerHost ??
        (Constants as any).manifest?.debuggerHost;
      if (debuggerHost) {
        const host = debuggerHost.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:8001`;
        }
      }
      return 'http://10.0.2.2:8001';
    }

    // iOS 真机 / 模拟器：从 Expo debuggerHost 获取开发机局域网 IP
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      (Constants as any).manifest?.debuggerHost;
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:8001`;
      }
    }

    // 兜底（仅 iOS 模拟器生效）
    return 'http://localhost:8001';
  }
  // 生产环境：优先读取 EXPO_PUBLIC_API_URL 环境变量（在 Vercel 控制台配置）
  // 兜底硬编码，避免未配置时 404
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://travel.offer.cc.cd';
};

const BASE_URL = getBaseUrl();
const TIMEOUT_MS = 45_000; // 前端总超时 45s，后端硬上限 30s + 15s 网络余量

// 开发时打印 API 地址，方便排查连接问题
if (__DEV__) {
  console.log('[HackTravel API] BASE_URL =', BASE_URL);
}

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
 * 带超时的 fetch — 增加网络连接失败的友好错误
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
    // 拦截非 JSON 响应（如 HTML 404/502 页面），给出可读的错误提示
    const originalJson = response.json.bind(response);
    response.json = async () => {
      const ct = response.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        const text = await response.text();
        if (__DEV__) {
          console.error(`[HackTravel API] Expected JSON but got (${ct}):`, text.slice(0, 200));
        }
        throw new Error(`后端服务未就绪或地址不正确（HTTP ${response.status}），请先部署后端并确认 API 地址`);
      }
      return originalJson();
    };
    return response;
  } catch (err: any) {
    // 区分超时 vs 网络不可达
    if (err?.name === 'AbortError') {
      throw err; // 超时，上层会处理为 modelTimeout
    }
    // TypeError: Network request failed — 典型的连接失败（手机访问不到后端）
    if (__DEV__) {
      console.error(`[HackTravel API] fetch failed: ${url}`, err?.message);
    }
    throw new Error(`无法连接服务器 (${BASE_URL})，请确保后端已启动且手机与电脑在同一局域网`);
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

/**
 * 获取雷达扫描系统实时状态
 */
export async function fetchScanStatus(): Promise<ScanStatusResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/watchlist/scan-status`,
    { method: 'GET' },
    8_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as ScanStatusResponse;
}

// ── Profile API (Tab4 用户中心) ─────────────────────────────

/**
 * 获取用户资料（不存在则自动创建）
 */
export async function fetchProfile(
  deviceId: string,
): Promise<UserProfileResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as UserProfileResponse;
}

/**
 * 更新用户资料
 */
export async function updateProfile(
  body: UserProfileUpdateRequest,
): Promise<UserProfileResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as UserProfileResponse;
}

/**
 * 获取用户统计数据
 */
export async function fetchProfileStats(
  deviceId: string,
): Promise<UserStatsResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/stats?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as UserStatsResponse;
}

/**
 * 获取用户偏好设置
 */
export async function fetchPreferences(
  deviceId: string,
): Promise<UserPreferencesResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/preferences?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as UserPreferencesResponse;
}

/**
 * 更新用户偏好设置
 */
export async function updatePreferences(
  body: UserPreferencesRequest,
): Promise<UserPreferencesResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/preferences`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as UserPreferencesResponse;
}

/**
 * 获取已保存行程列表
 */
export async function fetchSavedItineraries(
  deviceId: string,
): Promise<SavedItinerariesResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/itineraries?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as SavedItinerariesResponse;
}

/**
 * 保存行程到用户收藏
 */
export async function saveItinerary(
  body: SaveItineraryRequest,
): Promise<SaveItineraryResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/itineraries`,
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
  return data as SaveItineraryResponse;
}

/**
 * 删除已保存行程
 */
export async function deleteSavedItinerary(
  deviceId: string,
  itineraryId: string,
): Promise<DeleteItineraryResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/itineraries/${encodeURIComponent(itineraryId)}?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'DELETE' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as DeleteItineraryResponse;
}

/**
 * 获取单条已保存行程详情（含可选 legs 等完整信息）
 */
export async function fetchSavedItineraryDetail(
  deviceId: string,
  itineraryId: string,
): Promise<SavedItineraryDetailResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/profile/itineraries/${encodeURIComponent(itineraryId)}?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    10_000,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(parseErrorResponse(data));
  }
  return data as SavedItineraryDetailResponse;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth API — 用户认证
// ═══════════════════════════════════════════════════════════════════════════════

/** 获取存储的认证 token */
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return headers;
}

/**
 * 注册
 */
export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/register`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    15_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as AuthResponse;
}

/**
 * 登录（邮箱密码 或 手机验证码）
 */
export async function login(body: LoginRequest): Promise<AuthResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    15_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as AuthResponse;
}

/**
 * 社交登录
 */
export async function socialLogin(body: SocialLoginRequest): Promise<AuthResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/social`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    15_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as AuthResponse;
}

/**
 * 发送手机验证码
 */
export async function sendSmsCode(body: SendCodeRequest): Promise<SendCodeResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/send-code`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    10_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as SendCodeResponse;
}

/**
 * 获取当前用户
 */
export async function getMe(): Promise<AuthResponse> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/me`,
    { method: 'GET', headers: authHeaders() },
    10_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as AuthResponse;
}

/**
 * 退出登录
 */
export async function logout(): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/logout`,
    { method: 'POST', headers: authHeaders() },
    10_000,
  );
  const data = await response.json();
  _authToken = null;
  return data;
}

/**
 * 获取 AI 使用次数
 */
export async function getAIUsage(deviceId: string): Promise<AIUsageResponse> {
  const searchParams = new URLSearchParams({ device_id: deviceId });
  const response = await fetchWithTimeout(
    `${BASE_URL}/v1/auth/ai-usage?${searchParams.toString()}`,
    { method: 'GET', headers: authHeaders() },
    5_000,
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(parseErrorResponse(data));
  return data as AIUsageResponse;
}

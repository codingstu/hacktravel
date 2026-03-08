/**
 * HackTravel API Client
 * 对接后端 FastAPI 服务
 */
import { Platform } from 'react-native';
import {
  ItineraryGenerateRequest,
  ItineraryGenerateResponse,
  ErrorResponse,
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
const TIMEOUT_MS = 200_000; // 后端降级链最长约 180s (60s × 3 providers)

class ApiError extends Error {
  code: string;
  detail?: string;

  constructor(resp: ErrorResponse) {
    super(resp.message);
    this.code = resp.error_code;
    this.detail = resp.detail;
    this.name = 'ApiError';
  }
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
    throw new ApiError(data as ErrorResponse);
  }

  return data as ItineraryGenerateResponse;
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

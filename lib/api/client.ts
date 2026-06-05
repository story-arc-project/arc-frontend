"use client";

import { ApiError } from "./api-error";

export { ApiError } from "./api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEBUG = process.env.NEXT_PUBLIC_API_DEBUG === "true";

function logRequest(method: string, path: string, body?: unknown) {
  if (!DEBUG) return;
  console.log(`[API →] ${method} ${path}`, body ?? "");
}

function logResponse(method: string, path: string, status: number, duration: number) {
  if (!DEBUG) return;
  const color = status < 400 ? "color:green" : "color:red";
  console.log(`[API ←] %c${status}%c ${method} ${path} (${duration}ms)`, color, "");
}

// ──────────────────────────────────────────────
// Core request
// ──────────────────────────────────────────────

// `auth: false`를 넘기면 401 시 로그인 리다이렉트를 하지 않음 (비인증 라우트 전용)
type RequestOptions = RequestInit & { auth?: boolean };

// refresh 결과를 3분기로 구분한다. 5xx·네트워크 장애(일시적)와 401/403(재인증 필요)을
// 같은 false로 뭉개면, 일시 장애로 갱신에 실패한 유효 세션까지 로그아웃 처리된다.
type RefreshResult = "ok" | "unauthorized" | "error";

async function tryRefresh(): Promise<RefreshResult> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) return "ok";
    // 401/403 = refresh token 만료·무효 → 진짜 재인증 필요
    if (res.status === 401 || res.status === 403) return "unauthorized";
    // 그 외(5xx 등) = 일시 장애 → 세션을 끊지 않고 에러로 surface
    return "error";
  } catch {
    // 네트워크 오류도 일시 장애로 취급
    return "error";
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  const method = fetchOptions.method ?? "GET";
  logRequest(method, path, isFormData ? "[FormData]" : fetchOptions.body);
  const start = performance.now();

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: isFormData
      ? fetchOptions.headers
      : { "Content-Type": "application/json", ...fetchOptions.headers },
  });

  logResponse(method, path, res.status, Math.round(performance.now() - start));

  if (res.status === 401 && retry) {
    const refresh = await tryRefresh();
    if (refresh === "ok") {
      return request<T>(path, options, false);
    }
    if (refresh === "error") {
      // refresh 자체가 일시 장애(5xx·네트워크) → 비인증으로 단정하지 않는다.
      // /login으로 튕기지 않고 에러를 던져, 호출부(AuthGate 등)가 재시도 화면을 띄우게 한다.
      throw new ApiError(503, "인증 갱신에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    // refresh === "unauthorized" → 재인증 필요 → 진짜 로그아웃 흐름
    if (auth) window.location.href = "/login";
    throw new ApiError(401, "인증이 만료되었어요. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? "오류가 발생했어요.", body.code);
  }

  if (res.status === 204) return undefined as T;

  try {
    return await res.json() as T;
  } catch {
    throw new ApiError(res.status, "응답 형식이 올바르지 않아요.", "INVALID_JSON");
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

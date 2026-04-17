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

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
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
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
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

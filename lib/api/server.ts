import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "./api-error";

export { ApiError } from "./api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEBUG = process.env.API_DEBUG === "true";

function logRequest(method: string, path: string, body?: unknown) {
  if (!DEBUG) return;
  console.log(`[API.server →] ${method} ${path}`, body ?? "");
}

function logResponse(method: string, path: string, status: number, duration: number) {
  if (!DEBUG) return;
  const icon = status < 400 ? "✓" : "✗";
  console.log(`[API.server ←] ${icon} ${status} ${method} ${path} (${duration}ms)`);
}

// ──────────────────────────────────────────────
// Core request
// ──────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const method = options.method ?? "GET";
  logRequest(method, path, options.body);
  const start = performance.now();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // 사용자별 응답이 Next.js fetch 캐시에 저장되지 않도록 강제
    cache: options.cache ?? "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      ...options.headers,
    },
  });

  logResponse(method, path, res.status, Math.round(performance.now() - start));

  // 서버에서는 쿠키 갱신이 불가능하므로 401 즉시 리다이렉트
  if (res.status === 401) {
    redirect("/login");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? "오류가 발생했어요.", body.code);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestInit) {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestInit) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

import type { AuthUser } from "@/types/auth";
import { api, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

/**
 * GET /auth/me - 현재 로그인 사용자 정보 조회
 * 401(비인증)은 null로 반환, 그 외 장애는 throw해 호출부가 구분 처리한다.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (isDemoMode()) return demo.fetchCurrentUser();
  try {
    const res = await api.get<{ data: AuthUser }>("/auth/me", { auth: false });
    return res.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/**
 * POST /auth/logout - 로그아웃
 */
export async function logoutUser(): Promise<void> {
  if (isDemoMode()) return demo.logoutUser();
  await api.post("/auth/logout", undefined, { auth: false });
}

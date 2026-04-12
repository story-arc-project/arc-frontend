import type { AuthUser } from "@/types/auth";
import { api } from "@/lib/api/client";

/**
 * GET /auth/me - 현재 로그인 사용자 정보 조회
 * 401 시 에러를 throw 하지 않고 null 반환 (비인증 상태)
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await api.get<{ data: AuthUser }>("/auth/me", { auth: false });
    return res.data;
  } catch {
    return null;
  }
}

/**
 * POST /auth/logout - 로그아웃
 */
export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout", undefined, { auth: false });
}

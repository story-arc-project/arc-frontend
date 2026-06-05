import type { AuthUser } from "@/types/auth";
import { api, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";
import { seedDemoUser } from "@/lib/demo/seed";

/**
 * GET /auth/me - 현재 로그인 사용자 정보 조회
 * 401(비인증)은 null로 반환, 그 외 장애는 throw해 호출부가 구분 처리한다.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  // E2E 테스트 전용 인증 주입(FRT-24): 플래그가 켜졌을 때만 고정 사용자를 반환해
  // 로그인 플로우 없이 (main) 진입을 검증할 수 있게 한다. 환경 변수로만 활성화되고
  // 기본값은 off이므로 production/preview 동작은 불변이다. (process.env.NEXT_PUBLIC_E2E_AUTH는
  // 빌드 시 정적 치환되어 AuthProvider가 호출하는 클라이언트 번들에서도 평가된다.)
  if (process.env.NEXT_PUBLIC_E2E_AUTH === "true") return seedDemoUser;
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

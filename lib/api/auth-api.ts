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

/**
 * DELETE /auth/account/password - 비밀번호 계정 탈퇴(현재 비밀번호 재확인).
 * auth:false 로 보내 오답(401/4xx) 시 client.ts 의 자동 로그아웃 리다이렉트를 피한다.
 */
export async function deleteAccountWithPassword(password: string): Promise<void> {
  if (isDemoMode()) return demo.deleteAccountWithPassword();
  await api.delete("/auth/account/password", {
    auth: false,
    body: JSON.stringify({ password }),
  });
}

/**
 * DELETE /auth/account/social - 소셜 계정 탈퇴(OAuth 재실행으로 받은 code 재확인).
 */
export async function deleteAccountWithSocial(token: string): Promise<void> {
  if (isDemoMode()) return demo.deleteAccountWithSocial();
  await api.delete("/auth/account/social", {
    auth: false,
    body: JSON.stringify({ social: token }),
  });
}

/* ── 비밀번호 재설정 (FRT-8 / BAC-2) ──────────────────────────
 * 비인증 흐름(로그인 전)이므로 전부 auth:false 로 보내 401 자동 로그아웃 리다이렉트를 피한다.
 * 데모(`/demo`) 밖 전용 흐름이라 isDemoMode 분기는 두지 않는다.
 */

/**
 * POST /auth/forgot-password - 재설정 코드(6자리) 이메일 발송.
 * 가입 여부와 무관하게 항상 성공 처리한다(enumeration 방지) — 호출부도 결과를 분기하지 않는다.
 * 발송 rate limit 초과 시 429(ApiError)로 호출부에서 안내한다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email }, { auth: false });
}

/**
 * POST /auth/reset-password/verify - 코드 유효성만 검사(소모하지 않음).
 * 코드 입력 단계에서 즉시 피드백을 주기 위한 전용 엔드포인트.
 */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  await api.post("/auth/reset-password/verify", { email, code }, { auth: false });
}

/**
 * POST /auth/reset-password - 코드 재검증 후 새 비밀번호 설정.
 * code-vs-token 계약의 단일 격리 지점 — 백엔드가 토큰 방식을 택하면 이 함수 시그니처/바디만 바뀐다.
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await api.post("/auth/reset-password", { email, code, newPassword }, { auth: false });
}

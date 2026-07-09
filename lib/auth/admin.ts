import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { AuthUser } from "@/types/auth";

// admin 판별의 임시 소스: 서버 전용 env `ADMIN_EMAILS`(콤마 구분) 이메일 allowlist.
// NEXT_PUBLIC_ 접두사 금지 — 클라이언트 번들에 노출되면 운영자 이메일이 새어나간다.
// 백엔드(BAC-13)가 /auth/me 에 is_admin 을 실어주면 이 모듈은 그 필드로 대체·제거된다.
// 보안 본체는 항상 백엔드 서버사이드 인가이고, 이 프론트 가드는 UX + 추가 방어막이다.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * 이메일이 ADMIN_EMAILS allowlist 에 속하는지. 대소문자·앞뒤 공백을 무시하고,
 * 빈 항목(연속/꼬리 콤마)은 걸러낸다. env 미설정이면 누구도 admin 이 아니다(fail-closed).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(normalized);
}

/**
 * 서버에서 현재 로그인 사용자를 조회한다. 어떤 실패(401·5xx·네트워크·파싱)도
 * throw/redirect 없이 null 로 뭉갠다 — admin 가드는 실패 원인과 무관하게 "관리자 아님"으로
 * 처리해 경로 존재를 은닉해야 하기 때문이다. (lib/api/server.ts 는 401 에서 /login 으로
 * redirect 하므로 여기서 재사용하지 않고 쿠키 forward + 원시 fetch 를 둔다.)
 */
async function fetchCurrentUserServer(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });

    if (!res.ok) return null;

    // 응답 래퍼(`{ data: AuthUser }`) 방어 파싱 — 형태가 달라도 throw 하지 않는다.
    const body = (await res.json().catch(() => null)) as { data?: AuthUser } | null;
    return body?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 현재 사용자가 admin 이면 AuthUser, 아니면 null. 절대 throw/redirect 하지 않는다.
 * 진입점 노출 판정(/api/admin/status) 등 "조용한" 확인에 쓴다.
 */
export async function getAdminUserOrNull(): Promise<AuthUser | null> {
  const user = await fetchCurrentUserServer();
  if (!user) return null;
  return isAdminEmail(user.account?.email) ? user : null;
}

/**
 * admin 이 아니면(비로그인 포함) notFound() 로 404 를 던져 경로 존재 자체를 은닉한다.
 * admin route group 레이아웃의 서버사이드 가드 진입점.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAdminUserOrNull();
  if (!user) notFound();
  return user;
}

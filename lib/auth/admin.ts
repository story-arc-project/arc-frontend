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
  // E2E·UI 프리뷰 전용 인증 주입(FRT-24 플래그) — auth-api.ts 의 클라이언트 경로와 동일하게
  // 고정 사용자(seedDemoUser)를 반환해 서버사이드 admin 판정도 스텁 없이 태울 수 있게 한다.
  // 이 플래그는 이미 전체 인증을 우회하는 테스트 전용이며 production/preview 배포엔 설정하지 않는다.
  // (dynamic import 로 프로덕션 서버 번들에 데모 시드가 딸려오지 않게 한다.)
  if (process.env.NEXT_PUBLIC_E2E_AUTH === "true") {
    const { seedDemoUser } = await import("@/lib/demo/seed");
    return seedDemoUser;
  }

  try {
    // 프론트 요청에 실려온 쿠키를 백엔드로 forward 한다. 이 가드가 배포 환경에서
    // 동작하려면 auth 쿠키가 프론트 도메인에서 보여야 한다(백엔드와 공유 상위 도메인
    // 예: `.story-arc.org`). 백엔드 host-only 쿠키(예: api.story-arc.org 전용)면
    // 서버 cookies() 가 이를 못 봐 항상 401→null 이 된다 — .env.example 참고.
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

    // 401(access token 만료)이라도 서버사이드 refresh 는 하지 않고 fail-close 한다.
    // 서버 컴포넌트는 렌더 중 쿠키를 갱신·지속시킬 수 없고(Next 제약), refresh 토큰
    // 로테이션 시 갱신본을 브라우저에 못 돌려주면 오히려 세션이 깨진다 —
    // lib/api/server.ts:54("서버에서는 쿠키 갱신이 불가능")와 동일 정책이다. 갱신은
    // 클라이언트 client.ts 가 담당하며, 진입점 경로(/api/admin/status)는 useAuth 가
    // 클라이언트에서 이미 refresh 를 마친 뒤 호출돼 이 401 을 사실상 만나지 않는다.
    // (직접 /admin 진입 시의 만료-유휴 404 는 새로고침으로 회복 — fail-close = 안전 방향.)
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

import { NextResponse } from "next/server";

import { getAdminUserOrNull } from "@/lib/auth/admin";

// 사용자별 판정이므로 캐시 금지.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/status → { isAdmin: boolean }
 *
 * 클라이언트(useIsAdmin)가 admin 진입점 노출 여부를 조용히 확인하는 엔드포인트.
 * admin 판별 소스(서버 전용 ADMIN_EMAILS)는 클라이언트에서 읽을 수 없으므로 서버가 대신 판정한다.
 * 이건 UX 편의(진입점 표시)일 뿐 실제 보안 경계가 아니다 — 경계는 항상 /admin 레이아웃의 requireAdmin().
 *
 * next.config.ts 의 `/api/:path*` 백엔드 프록시는 afterFiles 단계라, check_fs 로 먼저 매칭되는
 * 이 route handler 가 우선한다(백엔드로 넘어가지 않음).
 * 백엔드(BAC-13)가 /auth/me 에 is_admin 을 실어주면 이 핸들러와 useIsAdmin 은 제거할 수 있다.
 */
export async function GET() {
  const admin = await getAdminUserOrNull();
  return NextResponse.json({ isAdmin: admin !== null });
}

"use client";

import { useEffect } from "react";

import { markInternalUser } from "@/lib/analytics";

import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * FRT-139: 팀(운영자) 계정의 행동을 지표에서 제외한다.
 *
 * 우리 넷이 하루에도 수십 번 오가는 행동이 실사용자 행동과 섞이면, 사용자가 15명인 유저테스트에서
 * 퍼널 숫자를 믿을 수 없다. 팀 계정으로 확인되면 person 에 `$internal_or_test_user` 를 심어
 * PostHog 의 내부/테스트 사용자 필터가 걸리게 한다(전송 자체는 막지 않는다 — 되돌릴 수 있게).
 *
 * 판정 소스는 서버 전용 env `ADMIN_EMAILS` 이고, 클라이언트는 `/api/admin/status` 가 내려주는
 * boolean 만 본다 — 운영자 이메일 목록은 번들에 실리지 않는다(lib/auth/admin.ts 의 계약).
 * 사람이 늘면 코드가 아니라 그 env 만 고치면 된다.
 *
 * RootLayout(AuthProvider 안)에 마운트한다. `(main)` 레이아웃이 아니라 루트인 이유는 가입 직후
 * `signup_completed` 가 `(auth)` 경로에서 발화하기 때문이다 — 거기서도 표식이 붙어 있어야 한다.
 *
 * GNB 도 같은 훅으로 admin 진입점 노출을 판정하므로 `(main)` 경로에서는 `/api/admin/status` 가
 * 두 번 나간다. 사용자별 판정이라 캐시할 수 없고(force-dynamic), 페이지 로드당 1회 추가라
 * 공용 캐시를 새로 들이는 것보다 중복을 감수하는 쪽이 변경 범위가 작다.
 */
export default function InternalUserTagger(): null {
  const isAdmin = useIsAdmin();

  useEffect(() => {
    // 판정이 false 인 동안은 아무것도 하지 않는다 — 훅의 기본값이 fail-close(false)라,
    // 판정 전/실패는 "팀원 아님"으로 흐르고 표식이 잘못 붙는 일은 없다.
    if (!isAdmin) return;
    // 식별(identify)이 아직이면 markInternalUser 가 예약해 두고 identify 직후에 심는다.
    markInternalUser();
  }, [isAdmin]);

  return null;
}

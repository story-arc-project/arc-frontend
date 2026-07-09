"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";

/**
 * 현재 사용자가 admin 인지 조용히 확인한다 — GNB 진입점(관리자 링크) 노출 판정용.
 *
 * admin 판별 소스(서버 전용 ADMIN_EMAILS)는 클라이언트가 읽을 수 없으므로, 서버가 대신 판정하는
 * `/api/admin/status` 를 인증된 경우에만 마운트 후 1회 호출한다(AuthContext 의 "마운트 후 fetch"
 * 패턴을 따라 (main) 정적성을 건드리지 않는다). 어떤 실패든 false(fail-close) — 이 훅이 잘못 true 를
 * 줘도 실제 보안 경계는 항상 /admin 레이아웃의 requireAdmin() 이므로 피해가 없다.
 *
 * 백엔드(BAC-13)가 /auth/me 에 is_admin 을 실어주면 이 훅은 useAuth().user 필드 참조로 대체·제거된다.
 */
export function useIsAdmin(): boolean {
  const { isAuthenticated } = useAuth();
  // 서버가 확인해준 admin 여부. 비인증 상태는 반환 시 마스킹하므로 여기서 동기 초기화하지 않는다.
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    fetch("/api/admin/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { isAdmin?: unknown } | null) => {
        if (!cancelled) setConfirmed(data?.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setConfirmed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // 로그아웃(isAuthenticated=false) 시 stale 값이 새지 않도록 인증 상태로 마스킹한다.
  return isAuthenticated && confirmed;
}

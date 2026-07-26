"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { isAdminPath } from "@/lib/monitoring/admin-path";

/**
 * admin 영역에 있는 동안만 Session Replay 녹화를 끈다.
 *
 * admin 은 고객 이메일·이름을 URL(`?q=`)에 싣는데, Replay 는 rrweb 스냅샷에 현재 주소를 그대로
 * 기록하고 **그 녹화 첨부는 이벤트 프로세서를 타지 않아** URL 스크러빙으로 못 지운다(Codex P1).
 *
 * 끄고 끝내면 안 된다 — SPA 라 "앱으로 돌아가기" 링크로 나가도 이 모듈이 다시 평가되지 않아,
 * 그 세션은 전체 새로고침 전까지 admin 밖 오류까지 Replay 없이 남는다(Codex P2). 그래서 경로가
 * admin 을 벗어나면 다시 켠다 — 그 시점의 URL 에는 고객 PII 가 없다.
 *
 * 부팅 시점에 이미 admin 이면 `instrumentation-client.ts` 가 표본율 0 으로 자동 녹화를 막는다
 * (여기 effect 보다 먼저 주소가 기록되는 것을 피하려면 부팅 판정이 필요하다). 통합 자체는 항상
 * 설치해 두므로, 나갈 때 이 가드가 켤 수 있다.
 */
export function SessionReplayGuard() {
  const pathname = usePathname();
  // 우리가 끈 경우에만 다시 켠다. 사용자가 자체적으로 멈춘 녹화를 되살리지 않기 위함.
  const suppressedRef = useRef(false);

  useEffect(() => {
    const replay = Sentry.getReplay();
    if (!replay) return;

    if (isAdminPath(pathname)) {
      suppressedRef.current = true;
      // 실패해도 화면에 영향이 없어야 하므로 조용히 흘린다.
      void Promise.resolve(replay.stop()).catch(() => {});
      return;
    }

    if (!suppressedRef.current) return;
    suppressedRef.current = false;
    try {
      replay.start();
    } catch {
      // 이미 녹화 중이면 SDK 가 거부한다 — 목표 상태가 이미 맞으므로 무시.
    }
  }, [pathname]);

  return null;
}

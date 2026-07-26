"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * admin 화면에 들어오면 Session Replay 녹화를 멈춘다.
 *
 * admin 은 고객 이메일·이름을 목록과 URL(`?q=`)에 싣는다. Replay 는 rrweb 스냅샷에 현재 주소
 * (`window.location.href`)를 그대로 기록하고 **그 녹화 첨부는 이벤트 프로세서를 타지 않아**
 * URL 스크러빙으로 막을 수 없다(Codex P1). 그래서 값을 지우는 대신 녹화 자체를 끊는다.
 *
 * 이 컴포넌트가 막는 건 앱 안에서 admin 으로 이동한 경우다. admin URL 로 바로 들어온 경우는
 * 여기 effect 가 돌기 전에 이미 주소가 녹화되므로, `instrumentation-client.ts` 가 부팅 시점에
 * Replay 를 아예 시작하지 않는다 — 두 경로를 함께 막아야 한다.
 *
 * 나갈 때 다시 켜지 않는다: 재개 시점 판단이 틀리면 고객 PII 가 녹화되므로 안전한 쪽으로
 * 실패시킨다(다음 페이지 로드에서 정상 재개된다).
 */
export function StopSessionReplay() {
  useEffect(() => {
    const replay = Sentry.getReplay();
    // stop() 은 프로미스를 준다 — 실패해도 화면에 영향이 없어야 하므로 조용히 흘린다.
    void replay?.stop().catch(() => {});
  }, []);

  return null;
}

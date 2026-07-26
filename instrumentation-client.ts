import * as Sentry from "@sentry/nextjs";

import { isAdminPath } from "@/lib/monitoring/admin-path";
import { installUrlRedaction } from "@/lib/monitoring/sentry-redaction";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// admin 주소로 **바로** 들어온 경우엔 자동 녹화를 켜지 않는다. Replay 는 rrweb 스냅샷에 현재
// 주소를 그대로 기록하는데 그 녹화 첨부는 이벤트 프로세서를 타지 않아 `?q=` 에 실린 고객
// 이메일을 지울 수 없고(Codex P1), 이 판정은 React effect 보다 먼저라 첫 스냅샷을 앞질러 막는다.
//
// 통합 자체는 **항상 설치한다** — 안 그러면 admin 에서 앱으로 돌아가도 SPA 라 이 모듈이 다시
// 평가되지 않아 그 세션이 새로고침 전까지 Replay 없이 남는다(Codex P2). 켜고 끄는 것은
// SessionReplayGuard 가 경로를 보고 맡는다.
const startsOnAdmin =
  typeof window !== "undefined" &&
  isAdminPath(window.location.pathname);

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    replaysSessionSampleRate: startsOnAdmin ? 0 : 0.1,
    replaysOnErrorSampleRate: startsOnAdmin ? 0 : 1.0,
    integrations: [Sentry.replayIntegration()],
  });

  // 검색어 파라미터에 실린 고객 PII 를 전송 직전에 지운다(FRT-16, Codex P1).
  installUrlRedaction();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

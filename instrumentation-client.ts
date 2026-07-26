import * as Sentry from "@sentry/nextjs";

import { installUrlRedaction } from "@/lib/monitoring/sentry-redaction";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// admin 주소로 바로 들어온 경우엔 Session Replay 를 아예 시작하지 않는다. Replay 는 rrweb
// 스냅샷에 현재 주소를 그대로 기록하는데, 그 녹화 첨부는 이벤트 프로세서를 타지 않아 `?q=` 에
// 실린 고객 이메일을 지울 수 없다(Codex P1). 부팅 시점 판정이라 effect 보다 먼저 막힌다 —
// 앱 안에서 admin 으로 이동한 경우는 StopSessionReplay 가 맡는다.
const startsOnAdmin =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    replaysSessionSampleRate: startsOnAdmin ? 0 : 0.1,
    replaysOnErrorSampleRate: startsOnAdmin ? 0 : 1.0,
    integrations: startsOnAdmin ? [] : [Sentry.replayIntegration()],
  });

  // 검색어 파라미터에 실린 고객 PII 를 전송 직전에 지운다(FRT-16, Codex P1).
  installUrlRedaction();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

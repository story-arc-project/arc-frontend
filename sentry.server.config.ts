import * as Sentry from "@sentry/nextjs";

import { installUrlRedaction } from "@/lib/monitoring/sentry-redaction";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });

  // 검색어 파라미터에 실린 고객 PII 를 전송 직전에 지운다(FRT-16, Codex P1).
  installUrlRedaction();
}

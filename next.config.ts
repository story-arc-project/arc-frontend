import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// PostHog Cloud EU(Frankfurt) 리버스 프록시 upstream (FRT-18).
// SDK 의 api_host 는 /ingest(자체 도메인 경유) → 아래 rewrites 가 EU 로 forward.
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com";

const nextConfig: NextConfig = {
  // PostHog 프록시는 trailing-slash 리다이렉트 없이 통과시켜야 한다(이벤트 유실 방지).
  skipTrailingSlashRedirect: true,
  // /terms·/privacy 가 빌드 시 읽는 법적 문서를 서버 번들에 포함(프로덕션 안전장치).
  outputFileTracingIncludes: {
    "/terms": ["./docs/legal/terms-of-service.draft.md"],
    "/privacy": ["./docs/legal/privacy-policy.draft.md"],
  },
  async rewrites() {
    return [
      // PostHog 정적 에셋(array.js 등) — EU assets 호스트로.
      {
        source: "/ingest/static/:path*",
        destination: `${POSTHOG_ASSETS_HOST}/static/:path*`,
      },
      // PostHog 이벤트·flags 수집 — EU 호스트로.
      {
        source: "/ingest/:path*",
        destination: `${POSTHOG_HOST}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});

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
      // PostHog remote config(/array/<token>/config) — CDN(assets) 경유로 캐싱.
      // catch-all 보다 먼저 매칭돼야 오리진(envoy) 대신 엣지 캐시를 탄다.
      {
        source: "/ingest/array/:path*",
        destination: `${POSTHOG_ASSETS_HOST}/array/:path*`,
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
  // 전역 Referrer-Policy — URL PII(email) 가 Referer 헤더로 새는 것을 차단 (FRT-83).
  // 앱이 /signup?email=... 처럼 쿼리에 email 을 싣는데, PostHog SDK 가 same-origin
  // /ingest/* 요청을 보낼 때 브라우저가 현재 URL 을 Referer 헤더에 붙이고 rewrite 가
  // 이를 PostHog EU 로 프록시하며 헤더까지 전달 → email 누출. 이 경로는 HTTP 헤더라
  // property_denylist·before_send 로 못 막는다.
  // strict-origin: origin 만 전송(path·query 제거), HTTPS→HTTP 다운그레이드 시 미전송.
  //   (기본값 strict-origin-when-cross-origin·same-origin 은 same-origin 요청에 full URL 을
  //    그대로 보내 누출을 못 막으므로 반드시 strict-origin 이상이어야 한다.)
  // 안전: PostHog 는 URL 을 window.location(JS)에서 읽으므로 헤더 스트립과 무관하고,
  //   ARC 는 $referrer·capture_pageview 를 이미 꺼 유입분석 손실이 없다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "strict-origin" }],
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

"use client";

import { useEffect } from "react";

import posthog from "posthog-js";
import { PostHogProvider as PostHogClientProvider } from "posthog-js/react";

// 분석 SDK 초기화 (FRT-18).
// - 키가 없으면(로컬 미설정·CI·E2E) 초기화하지 않는다 → 분석 비활성, 앱 동작에 영향 없음.
// - api_host 는 리버스 프록시 경로(next.config rewrites). 애드블록 회피·캡처율↑.
// - 프라이버시: autocapture 비활성·identified_only·Session Replay 비활성, PII 속성 전송 금지.
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // 키 미설정 시 분석을 켜지 않는다 (개발 편의·테스트 격리).
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      // 자체 도메인 경유 프록시 경로 (upstream 은 next.config rewrites 가 EU 로 forward).
      api_host: "/ingest",
      // 툴바·세션 링크가 올바른 EU 콘솔을 가리키도록.
      ui_host: "https://eu.posthog.com",
      // PII 최소화: 식별된 사용자에 한해서만 person profile 생성.
      person_profiles: "identified_only",
      // 자동 수집 비활성 — 이벤트는 명시적으로만 전송 (PII 미전송 보장).
      autocapture: false,
      // 자동 $pageview·$pageleave 비활성 — autocapture 와 별개로 기본 on 이라,
      // URL·쿼리스트링이 묵시적으로 수집되는 것을 막는다 (명시적 capture 만 허용).
      capture_pageview: false,
      capture_pageleave: false,
      // dead-click 자동 수집 비활성 — autocapture 와 별개 확장이라 명시적으로 꺼야
      // remote config 로 켜져도 $dead_click 이 나가지 않는다.
      capture_dead_clicks: false,
      // 기본 속성 중 PII 가 실릴 수 있는 URL 류 제거 — 앱이 /signup?email=... 처럼
      // 쿼리스트링에 PII 를 싣는 경로가 있어 명시적 이벤트에서도 새지 않게 차단.
      // ($pathname·$referring_domain 은 PII 없어 유지 → 경로 단위 분석은 가능)
      property_denylist: ["$current_url", "$referrer"],
      // Session Replay 비활성 — 무료 5K recordings/월 소진 방지.
      disable_session_recording: true,
    });
  }, []);

  return <PostHogClientProvider client={posthog}>{children}</PostHogClientProvider>;
}

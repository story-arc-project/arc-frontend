// FRT-19: 계측 래퍼.
//
// posthog-js 싱글턴(FRT-18 PostHogProvider 가 init)을 감싸, 컴포넌트가 아닌 곳(성공 핸들러)에서도
// 타입 안전하게 이벤트를 쏜다. 아래 두 경우엔 no-op 이다:
//  - 키 미설정(로컬·CI·E2E) → posthog.__loaded 가 false
//  - 데모 모드 → 실제 사용자가 아니므로 분석에서 제외
import posthog from "posthog-js";

import { isDemoMode } from "@/lib/demo/state";

import type { AnalyticsEventProps } from "./events";
import { hashUserId } from "./hash";

function isActive(): boolean {
  return posthog.__loaded === true && !isDemoMode();
}

// 타입드 capture — 이벤트명과 속성이 events.ts 의 계약과 어긋나면 컴파일 에러.
export function capture<E extends keyof AnalyticsEventProps>(
  event: E,
  props: AnalyticsEventProps[E],
): void {
  if (!isActive()) return;
  posthog.capture(event, props);
}

// 로그인/가입·재방문 시 해시된 이메일로 사용자를 식별한다(원본 이메일 미전송).
export async function identifyUser(emailSeed: string): Promise<void> {
  if (!isActive() || !emailSeed) return;
  const distinctId = await hashUserId(emailSeed);
  posthog.identify(distinctId);
}

// 로그아웃 시 익명 상태로 되돌려 다음 사용자와 세션이 섞이지 않게 한다.
export function resetUser(): void {
  if (!isActive()) return;
  posthog.reset();
}

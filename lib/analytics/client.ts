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

// identify 는 이메일 해시(async)를 기다리므로, 그 사이 로그아웃/사용자 전환이 일어날 수 있다.
// reset 마다 토큰을 올려, await 이전에 시작된 stale identify 가 로그아웃된 세션을 다시
// 식별하지 못하게 취소한다.
let identifyToken = 0;

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
  const token = identifyToken;
  const distinctId = await hashUserId(emailSeed);
  // 해시 대기 중 reset(로그아웃·탈퇴)이 끼어들었거나 비활성 전환되면 식별을 취소한다.
  if (token !== identifyToken || !isActive()) return;
  posthog.identify(distinctId);
}

// 로그아웃·세션 종료 시 익명 상태로 되돌려 다음 사용자와 세션이 섞이지 않게 한다.
export function resetUser(): void {
  // 진행 중인 identify 를 먼저 무효화한다(비활성 상태여도 토큰은 올린다).
  identifyToken++;
  if (!isActive()) return;
  posthog.reset();
}

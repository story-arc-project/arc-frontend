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

// FRT-139: 팀 계정 행동을 지표에서 제외하기 위한 person 표식.
// PostHog 가 내부/테스트 사용자 필터(프로젝트 test_account_filters → 코호트)에 쓰는 표준 속성이라,
// 이 값만 심으면 대시보드 쪽 배선은 이미 되어 있다. 전송을 막지 않고 표식만 남기는 이유는
// 되돌릴 수 있어서다 — 필터를 끄면 팀 행동도 다시 보인다.
const INTERNAL_USER_PROPERTY = "$internal_or_test_user";

// 팀원 판정(/api/admin/status)과 identify(/auth/me → 해시)는 서로 다른 왕복이라 도착 순서가
// 정해져 있지 않다. person_profiles 가 identified_only 라 식별 전에는 속성을 심어도 붙을 person 이
// 없으므로, 판정이 먼저 오면 보류했다가 identify 직후에 흘려보낸다.
let internalTagPending = false;
// 마운트마다 다시 심으면 그때마다 $set 이벤트가 쌓인다 — 식별된 사용자당 1회로 묶는다.
let internalTagSent = false;

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
  // 이제 붙일 person 이 생겼으니 보류된 내부 표식을 흘려보낸다.
  flushInternalUserTag();
}

// 이 사용자를 팀(운영자) 계정으로 표시한다 — 판정 소스는 서버 전용 ADMIN_EMAILS 이고,
// 클라이언트는 /api/admin/status 가 내려준 boolean 만 안다(운영자 이메일은 번들에 노출되지 않는다).
export function markInternalUser(): void {
  if (internalTagSent) return;
  internalTagPending = true;
  flushInternalUserTag();
}

// 식별이 끝나 있을 때만 실제로 심는다. 아니면 예약 상태로 두고 identifyUser 가 다시 부른다.
function flushInternalUserTag(): void {
  if (!internalTagPending || internalTagSent) return;
  // isIdentified 는 비활성(미초기화·데모)일 때 posthog 를 건드리지 않고 false 를 준다.
  if (!isIdentified()) return;
  posthog.setPersonProperties({ [INTERNAL_USER_PROPERTY]: true });
  internalTagPending = false;
  internalTagSent = true;
}

// posthog 가 아직 특정 사용자로 식별된 상태인지. distinct_id 는 localStorage 에 남으므로
// 새로고침·세션 만료로 앱 상태(ref)가 초기화돼도 이전 식별은 그대로 살아있다.
// 한 번도 식별된 적 없는 익명 방문자는 false → 매 로드마다 reset 해 distinct_id 를
// 갈아치우는 일(익명 퍼널 단절)을 막는다.
export function isIdentified(): boolean {
  if (!isActive()) return false;
  return posthog._isIdentified();
}

// 로그아웃·세션 종료 시 익명 상태로 되돌려 다음 사용자와 세션이 섞이지 않게 한다.
export function resetUser(): void {
  // 진행 중인 identify 를 먼저 무효화한다(비활성 상태여도 토큰은 올린다).
  identifyToken++;
  // 내부 표식도 여기서 비운다 — 비활성 상태여도 비워야, 같은 브라우저의 다음 사용자가
  // 팀원의 보류분을 물려받아 '내부 사용자'로 잘못 표시되지 않는다.
  internalTagPending = false;
  internalTagSent = false;
  if (!isActive()) return;
  posthog.reset();
}

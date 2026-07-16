// FRT-19: "1회만 발화" 판정용 localStorage 마커.
//
// 프론트에 lifetime-once 신호가 없는 이벤트(첫 기록·가입 완료)의 재발화를 막는다.
// 키는 이메일 해시로 스코프해 사용자별로 나눈다 — 디바이스 전역 마커로 두면 세 문제가 붙는다:
//  (a) 같은 기기의 다음 사용자가 자기 이벤트를 못 쏜다(under-count),
//  (b) 로그아웃·탈퇴·세션만료 등 "사용자가 바뀔 수 있는" 경로마다 지워줘야 하고,
//      하나라도 빠뜨리면 (a)가 되살아난다,
//  (c) 그렇다고 세션 만료에서 지우면, 온보딩을 중단했다가 만료 후 돌아온 '같은 사람'이
//      재로그인할 때 이벤트가 다시 발화한다(over-count). (b)와 (c)는 서로 모순이다.
// 사용자별 키는 셋을 한꺼번에 없앤다 — 지우는 경로 자체가 필요 없다.
//
// 원본 이메일은 저장하지 않는다(해시만). 이 해시는 이미 PostHog distinct_id 로 쓰는 값이라
// posthog-js 가 localStorage 에 보관하는 것과 동일 — 새로 늘어나는 노출은 없다.
import { hashUserId } from "./hash";

// 이 사용자에게 아직 마커가 없으면 세우고 true(→ 이벤트 발화). 이미 있으면 false.
// 판정이 불가능한 경우(사용자 미상·해시 실패·localStorage 접근 불가)엔 dedup 을 포기하고
// 발화한다 — 판정 불가 시 마커 도입 이전의 원래 동작으로 degrade 한다.
export async function markOnceForUser(
  baseKey: string,
  emailSeed: string,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!emailSeed) return true;

  let key: string;
  try {
    key = `${baseKey}:${await hashUserId(emailSeed)}`;
  } catch {
    return true;
  }

  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, "1");
  } catch {
    // 접근 불가(프라이빗 모드 등) — dedup 없이 발화(최선 노력).
  }
  return true;
}

// FRT-19: "1회만 발화" 판정용 디바이스 마커(localStorage) 공용 헬퍼.
//
// 프론트에 lifetime-once 신호가 없는 이벤트(첫 기록·가입 완료)의 재발화를 막는다.
// localStorage 접근 불가(프라이빗 모드)면 dedup 을 포기하고 발화를 허용한다 — 계측
// 누락보다 과계측이 낫다고 보는 게 아니라, 판정 불가 시 원래 동작으로 degrade 한다.

// 마커가 없으면 세우고 true(=최초). 이미 세워져 있으면 false(=발화 금지).
export function markOnce(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, "1");
  } catch {
    // 접근 불가 — dedup 없이 발화(최선 노력).
  }
  return true;
}

export function clearMarker(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 무시 — 마커 정리는 best-effort.
  }
}

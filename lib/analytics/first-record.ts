// FRT-19: first_record_created 의 "1회만" 판정.
//
// 프론트에 lifetime-first 플래그가 없어 서버 목록 count 로 1차 판정한다.
// 다만 count===1 만으로는 "전체 삭제 후 재생성"에서 재발화하므로, 디바이스 localStorage
// 마커로 같은 사용자·기기에서의 재발화를 막는다(over-count 방지 우선).
//
// 완전한 lifetime-first dedup 은 백엔드 신호가 있어야 가능하다(후속). 여기서는 최선 노력:
//  - localStorage 불가(프라이빗 모드) 시 count===1 만으로 발화하도록 degrade
//  - 로그아웃/탈퇴 시 clearFirstRecordMarker 로 마커를 비워 다음 사용자를 막지 않는다.
const FIRST_RECORD_KEY = "arc:first_record_emitted";

// 첫 기록이면 마커를 세우고 true 를 반환한다(→ 이벤트 발화). 이미 세워졌으면 false.
export function markFirstRecordIfUnseen(count: number): boolean {
  if (count !== 1) return false;
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(FIRST_RECORD_KEY)) return false;
    window.localStorage.setItem(FIRST_RECORD_KEY, "1");
  } catch {
    // localStorage 접근 불가 — count===1 만으로 발화(최선 노력).
  }
  return true;
}

export function clearFirstRecordMarker(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FIRST_RECORD_KEY);
  } catch {
    // 무시 — 마커 정리는 best-effort.
  }
}

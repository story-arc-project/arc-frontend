// FRT-19: first_record_created 의 "1회만" 판정.
//
// 프론트에 lifetime-first 플래그가 없어 서버 목록 count 로 1차 판정한다.
// 다만 count===1 만으로는 "전체 삭제 후 재생성"에서 재발화하므로, 사용자별 마커로
// 같은 사용자의 재발화를 막는다(over-count 방지 우선).
//
// 완전한 lifetime-first dedup 은 백엔드 신호가 있어야 가능하다(후속). 여기서는 최선 노력:
//  - 마커 키가 사용자별(이메일 해시)이라 같은 기기의 다른 사용자는 자기 첫 기록을 정상 발화
//  - localStorage 불가(프라이빗 모드) 시 count===1 만으로 발화하도록 degrade
import { markOnceForUser } from "./markers";

const FIRST_RECORD_KEY = "arc:first_record_emitted";

// 첫 기록이면 마커를 세우고 true 를 반환한다(→ 이벤트 발화). 이미 세워졌으면 false.
export function markFirstRecordIfUnseen(
  count: number,
  emailSeed: string,
): Promise<boolean> {
  if (count !== 1) return Promise.resolve(false);
  return markOnceForUser(FIRST_RECORD_KEY, emailSeed);
}

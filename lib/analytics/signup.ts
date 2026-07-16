// FRT-19: signup_completed 의 "1회만" 판정.
//
// 가입 완료 확정 지점은 "미온보딩 상태로 인증을 통과한 순간"인데, 백엔드 응답
// (AuthSuccessResult)에 '신규 계정 생성' 신호가 없다. 온보딩을 중도 이탈한 계정은 이후
// 재로그인해도 onboarded=false 로 같은 분기를 타므로, 그대로 두면 재시도마다 가입 완료가
// 다시 잡혀 전환수가 부풀려진다(이메일·구글 경로 공통).
//
// 백엔드 신호가 생기기 전까지의 최선 노력: 사용자별 마커로 재발화를 막는다.
// 키가 사용자별이라 같은 기기의 다음 사용자는 자기 가입을 정상 발화한다.
import { markOnceForUser } from "./markers";

const SIGNUP_COMPLETED_KEY = "arc:signup_completed_emitted";

// 이 사용자의 가입 완료를 아직 쏜 적 없으면 마커를 세우고 true(→ 이벤트 발화).
export function markSignupCompletedIfUnseen(emailSeed: string): Promise<boolean> {
  return markOnceForUser(SIGNUP_COMPLETED_KEY, emailSeed);
}

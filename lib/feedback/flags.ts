// FRT-92: 인앱 피드백 기능 플래그. 기본 off — 백엔드(BAC-34/35) 배포 전까지 사용자에게
// 노출되지 않게 막는다(FRT-5·FRT-8 전례). 엔드포인트가 뜨면 env 하나만 켠다.
//
// ⚠️ 전송 레이어(transport.ts)는 이 플래그를 모른다(flag-agnostic). 게이팅은 노출 판정
// 훅(FRT-93)과 모달(FRT-94)이 이 함수를 게이트로 소비한다.
//
// 상수(const)가 아니라 함수로 둔다 — isAdminEmail·getClientId 처럼 호출 시점에 env 를 읽어야
// vi.stubEnv 만으로 테스트된다(모듈 top-level 로 얼리면 resetModules + 동적 import 가 필요).
// NEXT_PUBLIC_* 는 빌드타임 인라인이라 런타임 값 변경은 재빌드가 필요하다(기존 USE_MOCK 과 동일).
export function isFeedbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "true";
}

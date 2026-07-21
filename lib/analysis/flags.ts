// FRT-108: 분석 재시도 기능 플래그. 기본 off — 백엔드 재시도 엔드포인트(BAC-42) 배포 전까지
// 사용자에게 노출되지 않게 막는다(FRT-5 CONSENT_ENABLED·FRT-8 PASSWORD_RESET_ENABLED·
// FRT-92 isFeedbackEnabled 전례). 엔드포인트가 뜨면 env 하나만 켠다.
//
// ⚠️ API 호출부(lib/api/analysis-api.ts)는 이 플래그를 모른다(flag-agnostic).
// 게이팅은 버튼 컴포넌트(RetryAnalysisButton)가 소비한다.
//
// 상수(const)가 아니라 함수로 둔다 — 호출 시점에 env 를 읽어야 vi.stubEnv 만으로 테스트된다.
// NEXT_PUBLIC_* 는 빌드타임 인라인이라 런타임 값 변경은 재빌드가 필요하다.
export function isAnalysisRetryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED === "true";
}

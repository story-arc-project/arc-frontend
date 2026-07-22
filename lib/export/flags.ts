// FRT-109: 레쥬메 생성 시 경험 선택 기능 플래그. 기본 off — 백엔드(BAC-45)가 experience_ids 를
// 수용하기 전까지 사용자에게 노출되지 않게 막는다(FRT-5 CONSENT_ENABLED·FRT-8 PASSWORD_RESET_ENABLED·
// FRT-92 isFeedbackEnabled·FRT-108 isAnalysisRetryEnabled 전례). 백엔드가 뜨면 env 하나만 켠다.
//
// ⚠️ 봉인이 특히 중요한 이유 — 백엔드의 ResumePostRequest 는 pydantic 기본값(extra="ignore")이라
// experience_ids 를 보내도 422 가 아니라 **200 으로 조용히 무시**한다. 즉 게이트 없이 노출하면
// 사용자가 3개를 골라도 전체 경험이 들어간 레쥬메가 "성공적으로" 나온다. 호출이 실패해 드러나는
// FRT-108(엔드포인트 부재 → 404)보다 나쁜 실패 모드다.
//
// ⚠️ API 호출부(lib/api/export-api.ts)도 목록 컴포넌트(ResumeExperiencePicker)도 이 플래그를
// 모른다(flag-agnostic). 게이팅은 **호출부**인 익스포트 페이지가 수행해 prop 으로 내린다.
// 플래그를 컴포넌트 안에서 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 때문에 Storybook 에서 항상
// false 가 되어 UI 를 영영 검증할 수 없다(FRT-108 에서 겪은 그대로).
//
// 상수(const)가 아니라 함수로 둔다 — 호출 시점에 env 를 읽어야 vi.stubEnv 만으로 테스트된다.
// NEXT_PUBLIC_* 는 빌드타임 인라인이라 런타임 값 변경은 재빌드가 필요하다.
export function isResumeExperienceSelectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RESUME_EXPERIENCE_SELECTION === "true";
}

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

// FRT-140: 자기소개서 작성·조회 화면 플래그. 기본 off — 백엔드(BAC-62)에 `cover_letter`
// 파이프라인이 **아예 없다**(arc-backend dev 트리 매치 0건). 위 경험 선택(FRT-109)과 달리
// 여기서는 엔드포인트 자체가 없어 호출하면 404 로 드러나지만, 그렇다고 사용자에게
// "만들기"를 보여줄 이유는 없다 — 누르면 실패하는 버튼이 되기 때문이다.
//
// ⚠️ 봉인이 필요한 또 하나의 이유 — 원본 명세(「AI 자기소개서 Generator 입력·출력 필드 명세」)는
// 파이썬 `main()/generate_application()` 시그니처 기준이라 **HTTP 경로도 요청 body 필드명도
// 규정하지 않는다.** 우리가 레쥬메 대칭으로 추정한 계약(lib/api/cover-letter-api.ts)이 BAC-62
// 확정본과 어긋날 수 있고, 플래그가 그 오차를 사용자에게서 막아 준다.
//
// 게이팅은 **호출부**(익스포트 페이지)가 수행한다. API 클라이언트도 화면 컴포넌트도 이 플래그를
// 모른다(flag-agnostic) — 컴포넌트 안에서 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 탓에
// Storybook 에서 항상 false 가 되어 UI 를 영영 검증할 수 없다(FRT-108 에서 겪은 그대로).
export function isCoverLetterEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COVER_LETTER_ENABLED === "true";
}

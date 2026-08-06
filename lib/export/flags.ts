// FRT-109: 레쥬메 생성 시 경험 선택 기능 플래그. 기본 off — 백엔드(BAC-45)가 experience_ids 를
// 수용하기 전까지 사용자에게 노출되지 않게 막았다(FRT-5 CONSENT_ENABLED·FRT-8 PASSWORD_RESET_ENABLED·
// FRT-92 isFeedbackEnabled·FRT-108 isAnalysisRetryEnabled 전례).
//
// ✅ 2026-08-07 라이브 대조: 백엔드가 이 필드를 실제로 받는다(`ResumePostRequest.experience_ids`,
// 소유권 검증 + 미존재 id 는 404). 봉인 사유였던 "extra=ignore 로 200 인 채 조용히 무시"는
// 해소됐다 — env 하나만 켜면 된다.
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

// FRT-140: 자기소개서 작성·조회 화면 플래그. 기본 off.
//
// 2026-08-07 라이브 대조로 상황이 바뀌었다 — 백엔드(BAC-62) 파이프라인은 **배포돼 있다**
// (`/export/cover_letter` POST·목록·상세 + ai_analyst 생성기). "arc-backend 에 매치 0건"이라던
// 이전 판단은 **로컬 체크아웃이 origin/dev 보다 110커밋 뒤처진 탓**이었다. 계약 경로도 바로잡았다
// (하이픈이 아니라 언더스코어, lib/api/cover-letter-api.ts 참고).
//
// ⚠️ 그래도 아직 켜지 않는 이유는 app 레이어 버그 2건이다(백엔드에 요청 전달 완료):
//   ① `CoverLetterPostRequest.questions` 가 `list[dict]` 라 **문자열 문항을 422 로 거절**한다.
//      글자수 제한은 우리 폼에서 선택 입력이라, 안 적은 사용자가 전원 막힌다.
//   ② 받은 `job_key`·`region` 을 DB 에만 저장하고 생성기 호출 인자에서 빠뜨려,
//      **미국형을 골라도 항상 한국형**으로 생성된다.
// 둘 다 고쳐지기 전에 켜면 사용자에게 그대로 보인다.
//
// 게이팅은 **호출부**(익스포트 페이지)가 수행한다. API 클라이언트도 화면 컴포넌트도 이 플래그를
// 모른다(flag-agnostic) — 컴포넌트 안에서 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 탓에
// Storybook 에서 항상 false 가 되어 UI 를 영영 검증할 수 없다(FRT-108 에서 겪은 그대로).
export function isCoverLetterEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COVER_LETTER_ENABLED === "true";
}

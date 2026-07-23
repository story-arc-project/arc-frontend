// FRT-16: admin 고객 목록·검색 노출 플래그. 기본 off — 백엔드(BAC-16)가 GET /admin/customers
// 를 배포하기 전까지 관리자에게도 실제 화면을 노출하지 않고 기존 "준비 중" placeholder 를 유지
// 한다(FRT-108 isAnalysisRetryEnabled·FRT-109 isResumeExperienceSelectionEnabled 전례).
// 백엔드가 뜨면 env 하나(NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED=true)만 켠다.
//
// ⚠️ 게이팅은 **호출부**(admin/customers 페이지·AdminNav)가 수행한다 — 목록/검색/페이지네이션
// 컴포넌트와 lib/api/admin-api 는 이 플래그를 모른다(flag-agnostic). 플래그를 컴포넌트 안에서
// 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 때문에 Storybook 에서 항상 false 가 되어 UI 를 영영
// 검증할 수 없다(FRT-108/109 에서 겪은 그대로).
//
// 상수(const)가 아니라 함수로 둔다 — 호출 시점에 env 를 읽어야 vi.stubEnv 만으로 테스트된다.
export function isAdminCustomersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED === "true";
}

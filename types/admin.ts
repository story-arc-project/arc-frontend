// FRT-16: admin 고객 목록·검색 도메인 타입.
//
// 백엔드 GET /admin/customers 계약(BAC-16)에 대응한다. 서버가 아직 없어 계약을 우리가
// 선확정했다(docs·BAC-16 코멘트 참고). 응답 필드는 snake_case 로 오고, lib/api/admin-api.ts
// 가 경계에서 camelCase 로 옮긴다. PII 는 최소만 노출한다 — 관리자 식별에 필요한 이메일·이름
// 까지만, 전화·주소·결제정보는 계약에서 제외.

/** 목록 행 1건. plan·status 는 백엔드 enum 코드 문자열(라벨 매핑은 표시 계층에서). */
export interface AdminCustomer {
  /** 상세(FRT-17 /admin/customers/{id}) 이동 키. */
  id: string;
  /** 식별자 + 검색 대상. */
  email: string;
  /** 표시명 — 미설정이면 null. */
  name: string | null;
  /** 요금제 코드(예: "free" | "pro"). 미지 코드는 원문 그대로 표시. */
  plan: string;
  /** 계정 상태 코드(예: "active" | "dormant" | "withdrawn"). */
  status: string;
  /** 온보딩 완료 여부. */
  onboarded: boolean;
  /** ISO 가입일. */
  createdAt: string;
}

/** 목록 응답 봉투 data 부분: { count, contents }. count 는 검색 조건 전체 건수(페이지네이션용). */
export interface AdminCustomerListData {
  count: number;
  contents: AdminCustomer[];
}

/** 목록 조회 파라미터. q 는 이메일/이름 부분일치 단일 검색어. */
export interface AdminCustomerQuery {
  q?: string;
  limit?: number;
  offset?: number;
}

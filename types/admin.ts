// FRT-16: admin 고객 목록·검색 도메인 타입.
//
// 백엔드 GET /admin/customers 계약(BAC-16)에 대응한다. 서버가 아직 없어 계약을 우리가
// 선확정했다(docs·BAC-16 코멘트 참고). 응답 필드는 snake_case 로 오고, lib/api/admin-api.ts
// 가 경계에서 camelCase 로 옮긴다. PII 는 최소만 노출한다 — 관리자 식별에 필요한 이메일·이름
// 까지만, 전화·주소·결제정보는 계약에서 제외.

/** 목록 행 1건. status 는 백엔드 enum 코드 문자열(라벨 매핑은 표시 계층에서). */
export interface AdminCustomer {
  /** 상세(FRT-17 /admin/customers/{id}) 이동 키. */
  id: string;
  /** 식별자 + 검색 대상. */
  email: string;
  /** 표시명 — 미설정이면 null. */
  name: string | null;
  /**
   * 계정 상태 코드. 백엔드 실재 enum 은 `"unverified" | "verified"` 둘뿐이다(FRT-17 에서
   * arc-backend 직독으로 정정 — 휴면·정지 개념은 백엔드에 없고 탈퇴는 별도 테이블이다).
   * 라벨 매핑은 `lib/admin/customer-status.ts` 가 단독으로 갖는다.
   */
  status: string;
  /** 온보딩 완료 여부. */
  onboarded: boolean;
  /** ISO 가입일. */
  createdAt: string;
}

/** 목록 응답 봉투 data 부분: { count, contents }. count 는 검색 조건 전체 건수(페이지네이션용). */
export interface AdminCustomerListData {
  /**
   * 검색 조건 전체 건수. 서버가 안 주면 **null(미상)** — 페이지 길이나 offset 으로 총계를
   * 지어내면 꽉 찬 페이지가 마지막 페이지처럼 보여 다음 페이지가 통째로 도달 불가능해진다.
   */
  count: number | null;
  contents: AdminCustomer[];
}

/** 목록 조회 파라미터. q 는 이메일/이름 부분일치 단일 검색어. */
export interface AdminCustomerQuery {
  q?: string;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRT-17: 고객 상세 + 활동 요약 (GET /admin/customers/{id}, BAC-17)
//
// 백엔드 미배포 — 계약을 우리가 선확정했다(BAC-17 코멘트 참고). PII 범위는 "운영 맥락까지":
// 계정 + 프로필의 소속·학교·학과·회사·희망직무까지만이고, **전화번호·생년월일·고민·관심사는
// 계약 단계에서 제외**했다. 화면에서만 숨기면 응답 본문과 모니터링에는 그대로 남기 때문이다.
// ─────────────────────────────────────────────────────────────────────────────

/** 계정 정보. 목록 행(AdminCustomer)에 탈퇴일·로그인 수단이 더해진 형태. */
export interface AdminCustomerAccount extends AdminCustomer {
  /**
   * 탈퇴일(ISO). 탈퇴는 status 값이 아니라 별도 deleted_users 테이블이라 독립 필드로 받는다.
   * 탈퇴하지 않았으면 null.
   */
  withdrawnAt: string | null;
  /** 소셜 로그인 provider 코드 목록(예: ["google"]). 이메일+비밀번호 가입만이면 빈 배열. */
  authProviders: string[];
}

/**
 * 프로필. 온보딩 전이라 프로필 자체가 없으면 상세의 `profile` 이 **null** 이고, 프로필은
 * 있으나 항목이 비어 있으면 각 필드가 null 이다 — 이 둘은 화면에서 다른 안내를 띄우므로
 * 매퍼가 구분해 유지한다.
 */
export interface AdminCustomerProfile {
  school: string | null;
  department: string | null;
  affiliation: string | null;
  affiliationDetail: string | null;
  company: string | null;
  desiredRole: string | null;
}

/** 활동 항목 1종의 집계. */
export interface AdminActivityStat {
  /**
   * 전체 건수. 서버가 안 주거나 숫자가 아니면 **null(미상)** — 0 으로 떨구면 "활동이 없는 고객"과
   * "집계에 실패한 응답"이 화면에서 똑같아 보인다.
   */
  total: number | null;
  /** 가장 최근 활동 시각(ISO). 없으면 null. */
  lastAt: string | null;
  /**
   * 상태별 건수(pending/queued/success/failed). 상태 개념이 없는 항목(기록)이나 서버가 주지
   * 않은 경우 null. 미지의 상태 키가 와도 그대로 담는다 — 라벨은 표시 계층이 판단한다.
   */
  byStatus: Record<string, number> | null;
}

/** 활동 요약에서 화면이 아는 항목 키. 이 목록에 없는 키는 매퍼가 조용히 버린다. */
export type AdminActivityKey =
  | "experiences"
  | "individualAnalyses"
  | "comprehensiveAnalyses"
  | "keywordAnalyses"
  | "resumes";

/**
 * 활동 요약. 서버가 특정 항목을 안 주면 그 값은 null(미상)이며, 화면은 0 이 아니라 "—"로 그린다.
 */
export type AdminCustomerActivity = Record<
  AdminActivityKey,
  AdminActivityStat | null
>;

/** GET /admin/customers/{id} 응답 봉투의 data 부분. */
export interface AdminCustomerDetail {
  customer: AdminCustomerAccount;
  /** 온보딩 전이면 null. */
  profile: AdminCustomerProfile | null;
  activity: AdminCustomerActivity;
}

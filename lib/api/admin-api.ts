// FRT-16: admin 고객 목록·검색 HTTP 클라이언트.
//
// 백엔드 GET /admin/customers(BAC-16)는 아직 미배포다 — 계약을 선확정하고 이 파일이 그 계약에
// 맞춰 요청/파싱한다. 서버는 응답을 { status, message, data } 로 래핑하고 필드는 snake_case 로
// 보낸다. 이 계층이 경계에서 snake→camel 로 옮기고, 형태 이상(래퍼 유무·null 배열·키 누락)에
// throw 하지 않고 안전 분기한다(.claude/rules/api.md 방어 파싱).
//
// 실패 경계: HTTP 실패(네트워크·4xx·5xx)는 그대로 throw 해 호출부(useAdminCustomers)가
// 로딩/에러를 구분하게 한다. 삼키는 건 "성공 응답의 형태 이상"뿐이다.
//
// demo 분기 없음 — admin 은 demo 모드(/demo)가 없다.

import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AdminActivityKey,
  AdminActivityStat,
  AdminCustomer,
  AdminCustomerActivity,
  AdminCustomerAccount,
  AdminCustomerDetail,
  AdminCustomerListData,
  AdminCustomerProfile,
  AdminCustomerQuery,
} from "@/types/admin";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// 배열이 아니면(null·객체·누락) 빈 배열로 — 봉투가 { contents: null } 로 와도 목록이 죽지 않게
// 한다(library-api 가 겪은 null 배열 destructure 크래시의 교훈).
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// name 은 nullable — 빈 문자열/비문자열은 null 로 정규화해 표시 계층이 "미설정"을 일관 처리한다.
function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapCustomer(raw: unknown): AdminCustomer {
  const r = asRecord(raw);
  return {
    id: asString(r.id),
    email: asString(r.email),
    name: asNullableString(r.name),
    status: asString(r.status),
    onboarded: asBoolean(r.onboarded),
    // snake/camel 이중키 폴백 — 계약 확정 전 백엔드 표기 차이를 흡수.
    createdAt: asString(r.created_at ?? r.createdAt),
  };
}

// 빈 검색어·기본값은 URL 에서 생략해 요청을 깨끗하게 유지한다. limit/offset 은 숫자일 때만 붙인다.
function buildQuery(query: AdminCustomerQuery): string {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set("q", q);
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  if (typeof query.offset === "number") {
    params.set("offset", String(query.offset));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function getAdminCustomers(
  query: AdminCustomerQuery = {},
): Promise<AdminCustomerListData> {
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/admin/customers${buildQuery(query)}`,
  );
  // 봉투 변형 흡수(api.md 방어 파싱): 보통은 { data: { count, contents } } 지만, BAC-16/스테이징이
  // 본문을 래핑 없이 { count, contents } 로 보낼 수도 있다. data 가 없으면 최상위 응답을 본문으로
  // 본다 — 안 그러면 res.data 가 undefined 라 목록이 조용히 0명이 된다(Codex review).
  const data = asRecord(res.data ?? res);
  const contents = asArray(data.contents).map(mapCustomer);
  // count 는 검색 조건 전체 건수(페이지네이션용). 서버가 안 주거나 숫자가 아니면 **추측하지 않고
  // null(미상)로 둔다**. 페이지 길이나 offset 으로 총계를 지어내면 꽉 찬 페이지가 마지막 페이지처럼
  // 보여 다음 페이지가 통째로 도달 불가능해지고, 호출부는 멀쩡한 페이지를 1로 깎는다(Codex P2).
  // 모른다는 사실을 그대로 올려보내야 화면이 "총계 미상" 모드로 안전하게 동작한다.
  const rawCount = data.count;
  const count =
    typeof rawCount === "number" && Number.isFinite(rawCount) ? rawCount : null;
  return { count, contents };
}

// ─────────────────────────────────────────────────────────────────────────────
// FRT-17: 고객 상세 + 활동 요약 (GET /admin/customers/{id}, BAC-17 미배포)
//
// 계약을 선확정하고 이 계층이 그 계약에 맞춰 파싱한다(BAC-17 코멘트). 목록과 같은 원칙:
// 형태 이상은 안전 분기하고, HTTP 실패는 그대로 throw 한다.
// ─────────────────────────────────────────────────────────────────────────────

// 건수는 count 와 같은 원칙 — **모르면 null(미상)**. 0 으로 떨구면 "활동이 없는 고객"과
// "집계에 실패한 응답"이 화면에서 구분되지 않는다. 음수·소수는 건수로 성립하지 않으므로
// 그대로 믿지 않고 미상으로 본다.
function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((v): v is string => typeof v === "string");
}

// asRecord 는 배열도 객체로 받아들인다(typeof [] === "object"). 활동 집계·프로필은 배열로 오면
// 형태가 어긋난 것이므로 여기서는 배열을 명시적으로 배제한다(FRT-134 의 asRecord 배열 가드 교훈).
function asPlainRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

// 상태별 건수: 숫자인 값만 남긴다. 상태 **키**는 검열하지 않는다 — 백엔드가 상태를 늘려도
// 표시 계층이 판단하도록 그대로 올려보낸다(모르는 키를 여기서 버리면 화면이 존재를 모른다).
function mapByStatus(raw: unknown): Record<string, number> | null {
  const r = asPlainRecord(raw);
  if (!r) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(r)) {
    const n = asCount(value);
    if (n !== null) out[key] = n;
  }
  return out;
}

function mapActivityStat(raw: unknown): AdminActivityStat | null {
  const r = asPlainRecord(raw);
  // 항목 자체가 없으면 null(미상) — 화면은 0 이 아니라 "—"로 그린다.
  if (!r) return null;
  return {
    total: asCount(r.total),
    lastAt: asNullableString(r.last_at ?? r.lastAt),
    byStatus: mapByStatus(r.by_status ?? r.byStatus),
  };
}

// 화면이 아는 활동 키 ↔ 계약(snake_case) 키. 여기 없는 키는 조용히 버린다 — 나중에 크레딧·결제
// 섹션이 붙어도(계약 §확장 규약) 이 화면이 모르는 값을 아는 척 그리지 않게 한다.
const ACTIVITY_KEYS: Record<AdminActivityKey, string> = {
  experiences: "experiences",
  individualAnalyses: "individual_analyses",
  comprehensiveAnalyses: "comprehensive_analyses",
  keywordAnalyses: "keyword_analyses",
  resumes: "resumes",
};

function mapActivity(raw: unknown): AdminCustomerActivity {
  const r = asPlainRecord(raw) ?? {};
  const out = {} as AdminCustomerActivity;
  for (const [camel, snake] of Object.entries(ACTIVITY_KEYS) as [
    AdminActivityKey,
    string,
  ][]) {
    out[camel] = mapActivityStat(r[snake] ?? r[camel]);
  }
  return out;
}

// 프로필은 **없음(null)** 과 **있으나 전부 미작성({})** 을 구분해 유지한다 — 전자는 온보딩 전이고
// 후자는 온보딩 후 미입력이라 운영자에게 다른 사실이며 화면 안내도 다르다.
// 계약에서 제외한 PII(phone·birth·worry·interest)는 서버가 보내더라도 여기서 흘려보내지 않는다.
function mapProfile(raw: unknown): AdminCustomerProfile | null {
  const r = asPlainRecord(raw);
  if (!r) return null;
  return {
    school: asNullableString(r.school),
    department: asNullableString(r.department),
    affiliation: asNullableString(r.affiliation),
    affiliationDetail: asNullableString(r.affiliation_detail ?? r.affiliationDetail),
    company: asNullableString(r.company),
    desiredRole: asNullableString(r.desired_role ?? r.desiredRole),
  };
}

function mapAccount(raw: unknown): AdminCustomerAccount {
  const r = asRecord(raw);
  return {
    ...mapCustomer(r),
    // 탈퇴는 status 값이 아니라 별도 deleted_users 테이블이라 독립 필드다.
    withdrawnAt: asNullableString(r.withdrawn_at ?? r.withdrawnAt),
    authProviders: asStringArray(r.auth_providers ?? r.authProviders),
  };
}

export async function getAdminCustomer(
  id: string,
): Promise<AdminCustomerDetail> {
  // id 를 그대로 이어붙이면 슬래시·쿼리 문자가 든 값이 경로를 다른 엔드포인트로 붕괴시킨다.
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/admin/customers/${encodeURIComponent(id)}`,
  );
  // 목록과 동일한 봉투 변형 흡수 — data 가 없으면 최상위를 본문으로 본다.
  const body = asRecord(res.data ?? res);
  const customer = mapAccount(body.customer);

  // 식별자가 통째로 비면 화면에 그릴 대상이 없다. 이걸 성공으로 통과시키면 운영자가 "정보가
  // 비어 있는 고객"을 사실로 읽는다 — 형태 이상 중 유일하게 여기서만 실패로 올린다.
  if (!customer.id && !customer.email) {
    throw new Error("고객 정보를 확인할 수 없어요.");
  }

  return {
    customer,
    profile: mapProfile(body.profile),
    activity: mapActivity(body.activity),
  };
}

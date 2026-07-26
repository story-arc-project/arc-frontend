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
  AdminCustomer,
  AdminCustomerListData,
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

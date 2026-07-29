// FRT-17: 고객 계정 상태 코드 → 표시 라벨. 목록(CustomerListView)과 상세(CustomerDetailPanels)가
// **같은 함수**를 쓴다 — 라벨 사본을 두 곳에 두면 한쪽만 고쳐져 화면마다 다른 말을 하게 된다
// (FRT-109 에서 사유 문구 사본이 조용히 낡은 그대로).
//
// ⚠️ 값 세트 정정(FRT-17): FRT-16 은 계약 확정 전이라 active/dormant/suspended/withdrawn 을
// 임시로 매핑했지만, arc-backend dev 를 직독한 결과 users.status 의 실재 enum 은
// **unverified | verified 둘뿐**이다(db/models.py UserStatus). 휴면·정지 개념은 백엔드에 없고,
// 탈퇴는 status 값이 아니라 별도 deleted_users 테이블(deleted_at)이라 상태 배지가 아닌
// withdrawn_at 으로 표시한다. 같은 정정을 BAC-16/BAC-17 계약 코멘트로도 보냈다.

/** Badge 의 variant 중 상태 표시에 쓰는 부분집합. */
export type CustomerStatusVariant = "success" | "warning" | "error" | "default";

export interface CustomerStatusMeta {
  label: string;
  variant: CustomerStatusVariant;
}

const STATUS_META: Record<string, CustomerStatusMeta> = {
  unverified: { label: "인증 전", variant: "warning" },
  verified: { label: "인증됨", variant: "success" },
};

/**
 * 알려진 상태 코드면 라벨·색을, 모르는 코드면 **null** 을 돌려준다.
 * 호출부는 null 일 때 코드 원문을 그대로 노출한다 — 백엔드가 값을 늘렸을 때 화면이 아는 척하며
 * 틀린 라벨을 붙이는 것보다, 모르는 코드가 그대로 보이는 편이 운영에 정직하다.
 */
export function getCustomerStatusMeta(status: string): CustomerStatusMeta | null {
  // Object.prototype 상속 키("constructor" 등)를 상태로 오인하지 않도록 자체 프로퍼티만 본다.
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return null;
  return STATUS_META[status];
}

// ─── 활동 상태(분석·이력서 공통 AnalysisStatus) ──────────────────────────────

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  success: "성공",
  failed: "실패",
  queued: "진행 중",
  pending: "대기",
};

// 표시 순서를 고정한다. 서버가 준 객체 키 순서를 그대로 쓰면 같은 고객이 새로고침마다 다른
// 순서로 보일 수 있고, 운영자가 가장 먼저 봐야 할 실패 건수의 위치가 매번 바뀐다.
const ACTIVITY_STATUS_ORDER = ["success", "failed", "queued", "pending"];

/** 활동 상태 코드의 한국어 라벨. 모르는 코드는 **원문 그대로** 돌려준다(라벨을 지어내지 않음). */
export function getActivityStatusLabel(status: string): string {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_STATUS_LABELS, status)
    ? ACTIVITY_STATUS_LABELS[status]
    : status;
}

/**
 * 상태 분해를 "성공 7 · 실패 1" 한 줄로 만든다. 표시할 게 없으면 null.
 *
 * 0 건인 상태는 생략한다 — 없는 걸 굳이 적으면 정작 봐야 할 실패 건수가 묻힌다.
 * 아는 상태를 고정 순서로 먼저 놓고, 백엔드가 나중에 늘린 미지 상태를 뒤에 이어 붙인다.
 */
export function formatActivityStatusBreakdown(
  byStatus: Record<string, number> | null | undefined,
): string | null {
  if (!byStatus) return null;
  const known = ACTIVITY_STATUS_ORDER.filter((s) => (byStatus[s] ?? 0) > 0);
  const unknown = Object.keys(byStatus)
    .filter((s) => !ACTIVITY_STATUS_ORDER.includes(s) && byStatus[s] > 0)
    .sort();
  const parts = [...known, ...unknown].map(
    (s) => `${getActivityStatusLabel(s)} ${byStatus[s]}`,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

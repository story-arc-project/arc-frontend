/**
 * 크레딧제 과금 관련 상수 (단일 출처).
 *
 * 과금 방식은 20차 회의(2026-07-12)에서 크레딧제로 확정됐다. 아래 값은 노션
 * "과금 모델 결정"의 MVP 초기 제시가로, 확정 변경 시 이 파일만 수정한다.
 * 컴포넌트에 가격·크레딧 수·차감량을 하드코딩하지 않는다.
 */

export interface CreditPackage {
  id: string;
  /** 충전되는 크레딧 수. */
  credits: number;
  /** 결제 금액(원, KRW). */
  price: number;
  /**
   * 용도 라벨(예: "가볍게"). 구매 데이터가 없으므로 "추천/인기" 대신 용도로 안내한다.
   * 데이터가 쌓이면 "가장 많이 선택" 등으로 교체 가능.
   */
  tag: string;
  /** 기본값으로 은은하게 강조할 패키지(주황 채움·배지 아님, 테두리 강조만). */
  recommended?: boolean;
}

/** 크레딧 충전 패키지(랜딩 노출용). 배열·요소 모두 불변. */
export const CREDIT_PACKAGES: readonly Readonly<CreditPackage>[] = [
  { id: "credits-15", credits: 15, price: 2900, tag: "가볍게" },
  { id: "credits-30", credits: 30, price: 4900, tag: "균형", recommended: true },
  { id: "credits-50", credits: 50, price: 7900, tag: "좋은 단가" },
];

/** 단일 차감량 또는 [최소, 최대] 범위(예: 이력서 3~5). */
export type CreditCostValue = number | readonly [number, number];

export interface CreditCost {
  /** 안정적 식별자 — 파생 계산은 배열 순서가 아니라 이 값으로 조회한다. */
  id: string;
  label: string;
  cost: CreditCostValue;
}

/**
 * 기능별 크레딧 차감량(랜딩 안내용). MVP 초기 제시값이며 확정 시 이 배열만 수정한다.
 * (id는 안정 유지 — 순서·항목이 바뀌어도 파생 환산이 어긋나지 않도록.)
 */
export const CREDIT_COSTS = [
  { id: "comprehensive", label: "종합 분석", cost: 2 },
  { id: "keyword", label: "키워드 분석", cost: 2 },
  { id: "resume", label: "이력서·자기소개서", cost: [3, 5] },
] as const satisfies readonly CreditCost[];

/** CREDIT_COSTS의 안정 식별자 유니온 — 오타를 컴파일 타임에 잡는다. */
export type CreditCostId = (typeof CREDIT_COSTS)[number]["id"];

/** id로 차감량을 조회한다(배열 순서 비의존). */
export function creditCost(id: CreditCostId): CreditCostValue {
  return CREDIT_COSTS.find((c) => c.id === id)!.cost;
}

/** 가입 시 지급하는 무료 크레딧 수. 확정 변경 시 이 값만 수정. */
export const SIGNUP_GRANT_CREDITS = 30;

/** 금액을 "2,900원" 형태로 표기한다. */
export function formatKrw(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

/** 차감량을 "2크레딧" 또는 "3~5크레딧"으로 표기한다. */
export function formatCost(cost: CreditCostValue): string {
  const amount = typeof cost === "number" ? String(cost) : `${cost[0]}~${cost[1]}`;
  return `${amount}크레딧`;
}

/**
 * 주어진 크레딧으로 해당 기능을 몇 번 쓸 수 있는지 체감 환산(내림).
 * 단일 차감량 → "15", 범위 차감량 → "6~10"(많이 쓰면 적게, 적게 쓰면 많이).
 */
export function creditRuns(credits: number, cost: CreditCostValue): string {
  if (typeof cost === "number") return String(Math.floor(credits / cost));
  const [min, max] = cost;
  return `${Math.floor(credits / max)}~${Math.floor(credits / min)}`;
}

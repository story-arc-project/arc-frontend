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
  /** 앵커로 강조할 추천 패키지. */
  recommended?: boolean;
}

/** 크레딧 충전 패키지(랜딩 노출용). 배열·요소 모두 불변. */
export const CREDIT_PACKAGES: readonly Readonly<CreditPackage>[] = [
  { id: "credits-15", credits: 15, price: 2900 },
  { id: "credits-30", credits: 30, price: 4900, recommended: true },
  { id: "credits-50", credits: 50, price: 7900 },
];

/** 단일 차감량 또는 [최소, 최대] 범위(예: 이력서 3~5). */
export type CreditCostValue = number | readonly [number, number];

export interface CreditCost {
  label: string;
  cost: CreditCostValue;
}

/** 기능별 크레딧 차감량(랜딩 안내용). 값 미확정 → 확정 시 이 배열만 수정. */
export const CREDIT_COSTS: readonly Readonly<CreditCost>[] = [
  { label: "종합 분석", cost: 2 },
  { label: "키워드 분석", cost: 2 },
  { label: "이력서·자기소개서", cost: [3, 5] },
];

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

/**
 * 크레딧제 과금 관련 상수 (단일 출처).
 *
 * 과금 방식은 20차 회의(2026-07-12)에서 크레딧제로 확정됐다. 아래 값은 노션
 * "과금 모델 결정"의 MVP 초기 제시가로, 확정 변경 시 이 파일만 수정한다.
 * 컴포넌트에 가격·크레딧 수를 하드코딩하지 않는다.
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

/**
 * 가입 시 지급하는 무료 크레딧 수.
 * 미확정(null) → 랜딩은 수치 없이 "무료 크레딧"으로만 안내한다. 확정 시 숫자로 교체.
 */
export const SIGNUP_GRANT_CREDITS: number | null = null;

/** 금액을 "2,900원" 형태로 표기한다. */
export function formatKrw(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

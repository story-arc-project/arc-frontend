export type CreditPackage = Readonly<{
  id: string;
  name: string;
  credits: number;
  price_krw: number;
}>;

/** 기획안 기준 공개 패키지. 백엔드 미제공·조회 실패 시에도 동일한 안내를 유지한다. */
export const DEFAULT_CREDIT_PACKAGES: readonly CreditPackage[] = Object.freeze([
  Object.freeze({ id: "lite", name: "Lite", credits: 20, price_krw: 4900 }),
  Object.freeze({ id: "basic", name: "Basic", credits: 50, price_krw: 9900 }),
  Object.freeze({ id: "pro", name: "Pro", credits: 120, price_krw: 19900 }),
]);

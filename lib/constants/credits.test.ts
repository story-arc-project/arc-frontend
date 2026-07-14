import { describe, expect, it } from "vitest";
import { CREDIT_PACKAGES, formatKrw } from "./credits";

describe("formatKrw", () => {
  it("천 단위 구분 쉼표와 '원' 접미사를 붙인다", () => {
    expect(formatKrw(2900)).toBe("2,900원");
    expect(formatKrw(7900)).toBe("7,900원");
  });

  it("0원도 표기한다", () => {
    expect(formatKrw(0)).toBe("0원");
  });

  it("만 단위도 올바르게 구분한다", () => {
    expect(formatKrw(10000)).toBe("10,000원");
  });
});

describe("CREDIT_PACKAGES", () => {
  it("id가 고유하다", () => {
    const ids = CREDIT_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("추천 패키지는 정확히 하나다", () => {
    expect(CREDIT_PACKAGES.filter((p) => p.recommended)).toHaveLength(1);
  });

  it("모든 패키지는 양의 크레딧과 가격을 가진다", () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.price).toBeGreaterThan(0);
    }
  });
});

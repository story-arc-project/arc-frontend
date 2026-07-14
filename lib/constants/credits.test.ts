import { describe, expect, it } from "vitest";
import {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  creditRuns,
  formatCost,
  formatKrw,
} from "./credits";

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

describe("formatCost", () => {
  it("단일 값은 'N크레딧'으로 표기한다", () => {
    expect(formatCost(2)).toBe("2크레딧");
  });

  it("범위 값은 'min~max크레딧'으로 표기한다", () => {
    expect(formatCost([3, 5])).toBe("3~5크레딧");
  });
});

describe("creditRuns", () => {
  it("단일 차감량은 나눈 몫(내림)을 문자열로 준다", () => {
    expect(creditRuns(30, 2)).toBe("15");
    expect(creditRuns(30, 4)).toBe("7"); // 내림
  });

  it("범위 차감량은 'max몫~min몫'으로 준다 (많이 쓰면 적게, 적게 쓰면 많이)", () => {
    expect(creditRuns(30, [3, 5])).toBe("6~10");
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

describe("CREDIT_COSTS", () => {
  it("각 항목은 라벨과 차감량을 가진다", () => {
    expect(CREDIT_COSTS.length).toBeGreaterThan(0);
    for (const c of CREDIT_COSTS) {
      expect(c.label).toBeTruthy();
      expect(c.cost).toBeDefined();
    }
  });
});

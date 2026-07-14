import { describe, expect, it } from "vitest";
import {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  creditCost,
  creditRuns,
  formatCost,
  formatKrw,
} from "./credits";

// 포매터·산술 테스트는 config(가격·차감량) 값을 재기술하지 않고 합성값으로 로직만 검증한다.
// (config가 단일 출처 — 비즈니스 숫자가 바뀌어도 이 테스트는 영향을 받지 않아야 한다.)
describe("formatKrw", () => {
  it("천 단위 구분 쉼표와 '원' 접미사를 붙인다", () => {
    expect(formatKrw(1234)).toBe("1,234원");
    expect(formatKrw(999)).toBe("999원");
  });

  it("0원도 표기한다", () => {
    expect(formatKrw(0)).toBe("0원");
  });

  it("백만 단위도 올바르게 구분한다", () => {
    expect(formatKrw(1234567)).toBe("1,234,567원");
  });
});

describe("formatCost", () => {
  it("단일 값은 'N크레딧'으로 표기한다", () => {
    expect(formatCost(7)).toBe("7크레딧");
  });

  it("범위 값은 'min~max크레딧'으로 표기한다", () => {
    expect(formatCost([4, 9])).toBe("4~9크레딧");
  });
});

describe("creditRuns", () => {
  it("단일 차감량은 나눈 몫(내림)을 문자열로 준다", () => {
    expect(creditRuns(100, 4)).toBe("25");
    expect(creditRuns(100, 7)).toBe("14"); // 내림
  });

  it("범위 차감량은 'max몫~min몫'으로 준다 (많이 쓰면 적게, 적게 쓰면 많이)", () => {
    expect(creditRuns(100, [4, 5])).toBe("20~25");
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

  it("모든 패키지는 용도 라벨(tag)을 가진다", () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.tag).toBeTruthy();
    }
  });
});

describe("CREDIT_COSTS", () => {
  it("각 항목은 id·라벨·차감량을 가진다", () => {
    expect(CREDIT_COSTS.length).toBeGreaterThan(0);
    for (const c of CREDIT_COSTS) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.cost).toBeDefined();
    }
  });

  it("id는 고유하다", () => {
    const ids = CREDIT_COSTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("creditCost", () => {
  // 비즈니스 숫자(2·[3,5])를 재기술하지 않고, 조회가 각 항목의 cost를 그대로
  // 돌려주는지(배열 순서 비의존) 구조적으로 검증한다.
  it("id로 해당 항목의 cost를 그대로 돌려준다", () => {
    for (const c of CREDIT_COSTS) {
      expect(creditCost(c.id)).toEqual(c.cost);
    }
  });
});

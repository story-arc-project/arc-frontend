import { afterEach, describe, expect, it, vi } from "vitest";

import { isAdminCustomersEnabled } from "./flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdminCustomersEnabled", () => {
  it("env 미설정이면 false(기본 봉인)", () => {
    expect(isAdminCustomersEnabled()).toBe(false);
  });

  it('정확히 "true" 일 때만 true', () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED", "true");
    expect(isAdminCustomersEnabled()).toBe(true);
  });

  it('"true" 가 아닌 값은 모두 false', () => {
    for (const v of ["false", "1", "TRUE", "yes", ""]) {
      vi.stubEnv("NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED", v);
      expect(isAdminCustomersEnabled()).toBe(false);
    }
  });
});

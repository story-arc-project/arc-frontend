import { describe, expect, it } from "vitest";

import { isAdminPath } from "./admin-path";

describe("isAdminPath", () => {
  it("admin 루트와 하위 경로를 admin 으로 본다", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/customers")).toBe(true);
    expect(isAdminPath("/admin/customers/c1")).toBe(true);
    expect(isAdminPath("/admin?tab=1")).toBe(true);
  });

  it("이름만 비슷한 남의 경로를 admin 으로 오인하지 않는다", () => {
    expect(isAdminPath("/administrators")).toBe(false);
    expect(isAdminPath("/dashboard")).toBe(false);
    expect(isAdminPath("/archive/admin")).toBe(false);
  });

  it("빈 값에도 안전하다", () => {
    expect(isAdminPath(null)).toBe(false);
    expect(isAdminPath(undefined)).toBe(false);
    expect(isAdminPath("")).toBe(false);
  });
});

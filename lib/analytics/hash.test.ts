import { describe, expect, it } from "vitest";

import { hashUserId } from "@/lib/analytics/hash";

describe("hashUserId — 이메일 → 안정적 가명 식별자(FRT-19)", () => {
  it("SHA-256 hex(64자) 문자열을 반환한다", async () => {
    const h = await hashUserId("test@example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("같은 입력은 항상 같은 해시를 낸다(안정적 식별)", async () => {
    const a = await hashUserId("test@example.com");
    const b = await hashUserId("test@example.com");
    expect(a).toBe(b);
  });

  it("대소문자·공백 차이는 같은 사용자로 정규화된다", async () => {
    const canonical = await hashUserId("test@example.com");
    expect(await hashUserId("  TEST@Example.com ")).toBe(canonical);
  });

  it("다른 이메일은 다른 해시를 낸다", async () => {
    const a = await hashUserId("a@example.com");
    const b = await hashUserId("b@example.com");
    expect(a).not.toBe(b);
  });

  it("원본 이메일 문자열이 해시에 그대로 남지 않는다(비가역)", async () => {
    const h = await hashUserId("secret@example.com");
    expect(h).not.toContain("secret");
    expect(h).not.toContain("example");
  });
});

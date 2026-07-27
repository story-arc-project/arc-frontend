import { describe, expect, it } from "vitest";

import { redactUrlQuery } from "./redact-url";

function q(url: string): string | null {
  return new URL(url, "https://app.story-arc.org").searchParams.get("q");
}

describe("redactUrlQuery", () => {
  it("검색어 값을 가린다(관리자 고객 검색은 이메일이 URL 에 실린다)", () => {
    const out = redactUrlQuery(
      "https://app.story-arc.org/admin/customers?q=hong.gildong%40example.com",
    );
    expect(q(out)).toBe("[Filtered]");
    expect(out).not.toContain("hong.gildong");
    expect(out).not.toContain("example.com");
  });

  it("같은 URL 의 다른 파라미터는 그대로 둔다", () => {
    const out = redactUrlQuery("/admin/customers?q=kim&page=3");
    expect(q(out)).toBe("[Filtered]");
    expect(new URL(out, "https://x.dev").searchParams.get("page")).toBe("3");
  });

  it("가릴 값이 없으면 원문을 손대지 않는다", () => {
    expect(redactUrlQuery("/admin/customers?page=3")).toBe(
      "/admin/customers?page=3",
    );
    expect(redactUrlQuery("/admin/customers")).toBe("/admin/customers");
  });

  it("해시(fragment)를 잃지 않는다", () => {
    const out = redactUrlQuery("/admin/customers?q=kim#row-3");
    expect(out.endsWith("#row-3")).toBe(true);
    expect(out).not.toContain("kim");
  });

  it("빈 값·비정상 입력에도 던지지 않는다", () => {
    expect(redactUrlQuery("")).toBe("");
    expect(redactUrlQuery("?")).toBe("?");
    expect(redactUrlQuery("not a url at all")).toBe("not a url at all");
  });

  it("값이 여러 번 실려도 전부 가린다", () => {
    const out = redactUrlQuery("/admin/customers?q=kim&q=lee");
    expect(out).not.toContain("kim");
    expect(out).not.toContain("lee");
  });

  it("가릴 파라미터 이름을 지정할 수 있다", () => {
    const out = redactUrlQuery("/x?email=a%40b.com&page=1", ["email"]);
    expect(new URL(out, "https://x.dev").searchParams.get("email")).toBe(
      "[Filtered]",
    );
    expect(out).not.toContain("a%40b.com");
  });
});

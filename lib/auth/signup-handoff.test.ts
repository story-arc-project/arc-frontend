import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSignupHandoff, createSignupHandoff, readSignupHandoff } from "./signup-handoff";

describe("signup handoff", () => {
  beforeEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); vi.restoreAllMocks(); });
  it("keeps email out of URL and restores the same flow across reads", () => {
    const url = createSignupHandoff("reader@example.test");
    expect(url).toMatch(/^\/signup\?step=verify&flow=[\w-]+$/);
    const flow = new URL(url!, "http://localhost").searchParams.get("flow");
    expect(readSignupHandoff(flow)).toBe("reader@example.test");
    expect(readSignupHandoff(flow)).toBe("reader@example.test");
    expect(readSignupHandoff("other")).toBeNull();
  });
  it("replaces previous accounts and clears explicitly", () => {
    const first = new URL(createSignupHandoff("a@example.test")!, "http://localhost").searchParams.get("flow");
    const second = new URL(createSignupHandoff("b@example.test")!, "http://localhost").searchParams.get("flow");
    expect(readSignupHandoff(first)).toBeNull();
    expect(readSignupHandoff(second)).toBe("b@example.test");
    clearSignupHandoff();
    expect(readSignupHandoff(second)).toBeNull();
  });
  it("rejects expired and future-dated handoffs", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const flow = new URL(createSignupHandoff("a@example.test")!, "http://localhost").searchParams.get("flow");
    vi.mocked(Date.now).mockReturnValue(now + 30 * 60 * 1000);
    expect(readSignupHandoff(flow)).toBeNull();
    vi.mocked(Date.now).mockReturnValue(now);
    const future = new URL(createSignupHandoff("a@example.test")!, "http://localhost").searchParams.get("flow");
    vi.mocked(Date.now).mockReturnValue(now - 1);
    expect(readSignupHandoff(future)).toBeNull();
  });
  it("fails safely for malformed context and blocked storage", () => {
    for (const value of ["null", "{", JSON.stringify({ flow: "flow", email: 7, createdAt: Date.now() }), JSON.stringify({ flow: "flow", email: "a@example.test", createdAt: "wrong" })]) {
      sessionStorage.setItem("arc:signup-handoff", value);
      expect(readSignupHandoff("flow")).toBeNull();
    }
    const blocked = () => { throw new Error("blocked"); };
    vi.stubGlobal("sessionStorage", { setItem: blocked, getItem: blocked, removeItem: blocked });
    expect(createSignupHandoff("a@example.test")).toBeNull();
    expect(readSignupHandoff("flow")).toBeNull();
    expect(() => clearSignupHandoff()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

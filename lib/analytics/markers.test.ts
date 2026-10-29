import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markOnceForUser } from "./markers";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => localStorage.clear());

describe("marker claims across same-origin tabs", () => {
  it("claims under the same Web Lock with only one winner", async () => {
    let tail = Promise.resolve();
    const names: string[] = [];
    const request = vi.fn((name: string, claim: () => boolean) => {
      names.push(name);
      const pending = tail.then(claim);
      tail = pending.then(() => undefined);
      return pending;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    const claims = await Promise.all([
      markOnceForUser("signup", "person@example.com"),
      markOnceForUser("signup", "person@example.com"),
    ]);
    expect(claims.sort()).toEqual([false, true]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(names[0]).toBe(names[1]);
    expect(names[0]).not.toContain("person@example.com");
  });

  it("keeps the best-effort marker when Web Locks is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    expect(await markOnceForUser("signup", "person@example.com")).toBe(true);
    expect(await markOnceForUser("signup", "person@example.com")).toBe(false);
  });

  it("degrades without rejecting when a lock request fails", async () => {
    vi.stubGlobal("navigator", { locks: { request: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await markOnceForUser("signup", "person@example.com")).toBe(true);
    expect(await markOnceForUser("signup", "person@example.com")).toBe(false);
  });
});

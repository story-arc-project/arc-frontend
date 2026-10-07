import { afterEach, describe, expect, it, vi } from "vitest";
import { getCreditPackages, getCreditPackagesStrict } from "./credit-packages-api";
import { DEFAULT_CREDIT_PACKAGES } from "../constants/credit-packages";

const pack = { id: "lite", name: "Lite", credits: 20, price_krw: 4900 };
function respond(body: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", mock);
  return mock;
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("getCreditPackages", () => {
  it("uses validated server packages and strips unknown fields", async () => {
    const mock = respond({ packages: [{ ...pack, credits: 25, available: true, cost: 3 }] });
    expect(await getCreditPackages()).toEqual([{ ...pack, credits: 25 }]);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining("/credits/packages"), expect.objectContaining({ credentials: "omit", signal: expect.any(AbortSignal) }));
  });
  it("falls back on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await getCreditPackages()).toBe(DEFAULT_CREDIT_PACKAGES);
  });
  it.each([401, 404, 500])("falls back on HTTP %s without retrying or refreshing auth", async (status) => {
    const mock = respond({}, status);
    expect(await getCreditPackages()).toBe(DEFAULT_CREDIT_PACKAGES);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it.each([
    null, {}, { packages: [] }, { packages: [pack, pack] },
    { packages: [pack, { ...pack, id: "other" }] },
    { packages: [{ ...pack, credits: 0 }] }, { packages: [{ ...pack, credits: 1.5 }] },
    { packages: [{ ...pack, price_krw: -1 }] }, { packages: [{ ...pack, credits: Number.MAX_SAFE_INTEGER + 1 }] },
    { packages: [{ ...pack, id: " " }] }, { packages: [{ ...pack, name: " " }] },
    { packages: [pack, { ...pack, id: "bad", credits: "30" }] },
    { packages: Array.from({ length: 21 }, (_, i) => ({ ...pack, id: `${i}`, name: `${i}` })) },
  ])("falls back for an invalid catalog (%j)", async (body) => {
    respond(body);
    expect(await getCreditPackages()).toBe(DEFAULT_CREDIT_PACKAGES);
  });
  it("falls back on malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{")));
    expect(await getCreditPackages()).toBe(DEFAULT_CREDIT_PACKAGES);
  });
  it("bounds a request that never responds and aborts its signal", async () => {
    vi.useFakeTimers();
    const mock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", mock);
    const pending = getCreditPackages();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe(DEFAULT_CREDIT_PACKAGES);
    expect(mock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("aborts on caller cancellation and cleans up its timeout", async () => {
    vi.useFakeTimers();
    const mock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", mock);
    const controller = new AbortController();
    const pending = getCreditPackages(controller.signal);
    controller.abort();
    expect(await pending).toBe(DEFAULT_CREDIT_PACKAGES);
    expect(mock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not fetch if already cancelled", async () => {
    const mock = respond({ packages: [pack] });
    const controller = new AbortController();
    controller.abort();
    expect(await getCreditPackages(controller.signal)).toBe(DEFAULT_CREDIT_PACKAGES);
    expect(mock).not.toHaveBeenCalled();
  });
  it("keeps the planning defaults immutable", () => {
    expect(Object.isFrozen(DEFAULT_CREDIT_PACKAGES)).toBe(true);
    expect(DEFAULT_CREDIT_PACKAGES.every(Object.isFrozen)).toBe(true);
    expect(DEFAULT_CREDIT_PACKAGES.map(({ credits, price_krw }) => [credits, price_krw])).toEqual([[20, 4900], [50, 9900], [120, 19900]]);
  });
});


describe("getCreditPackagesStrict", () => {
  it("returns validated prices without hiding errors behind defaults", async () => {
    respond({ packages: [pack] });
    expect(await getCreditPackagesStrict()).toEqual([pack]);
    respond({}, 503);
    await expect(getCreditPackagesStrict()).rejects.toThrow();
    respond({ packages: [] });
    await expect(getCreditPackagesStrict()).rejects.toThrow();
  });
  it("rejects a hanging response at the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const result = expect(getCreditPackagesStrict()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    await result;
  });
  it("rejects cancellation without returning a purchasable catalog", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(getCreditPackagesStrict(controller.signal)).rejects.toThrow();
  });
});

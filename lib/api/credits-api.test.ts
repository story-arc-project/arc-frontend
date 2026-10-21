import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";
import { getCredits, parseCreditBalance } from "./credits-api";
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), api: { get: vi.fn() } }));
const valid = { balance: 50, reserved: 3, available: 47, updated_at: "2026-09-30T00:00:00Z" };
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
describe("credit contract", () => {
  it("accepts normal and zero balances and ignores extra fields", () => {
    expect(parseCreditBalance({ ...valid, secret: 1 })).toEqual(valid);
    expect(parseCreditBalance({ ...valid, balance: 0, reserved: 0, available: 0 }).available).toBe(0);
  });
  it.each([
    null, {}, { ...valid, balance: -1 }, { ...valid, reserved: 1.5 },
    { ...valid, available: "47" }, { ...valid, balance: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, reserved: 51 }, { ...valid, available: 48 },
    { ...valid, updated_at: "yesterday" }, { ...valid, updated_at: "2026-09-30T00:00:00" },
    { ...valid, updated_at: "2026-02-30T00:00:00Z" },
  ])("rejects malformed payload %#", (value) => expect(() => parseCreditBalance(value)).toThrow());
  it("uses authenticated client with no-store and abort signal", async () => {
    vi.mocked(api.get).mockResolvedValue(valid);
    const signal = new AbortController().signal;
    await expect(getCredits(signal)).resolves.toEqual(valid);
    expect(api.get).toHaveBeenCalledWith("/credits", { cache: "no-store", signal: expect.any(AbortSignal) });
  });
  it.each([404, 501, 500, 401])("preserves HTTP %i for caller classification", async (status) => {
    const error = new ApiError(status, "error");
    vi.mocked(api.get).mockRejectedValue(error);
    await expect(getCredits()).rejects.toBe(error);
  });
  it("preserves abort", async () => {
    const error = new DOMException("aborted", "AbortError");
    vi.mocked(api.get).mockRejectedValue(error);
    await expect(getCredits()).rejects.toBe(error);
  });
});

it("times out the whole request even when client ignores abort", async () => {
  vi.useFakeTimers();
  vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
  const request = getCredits();
  const assertion = expect(request).rejects.toThrow("시간");
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(vi.mocked(api.get).mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels promptly even when the client ignores the signal", async () => {
  vi.useFakeTimers();
  vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const request = getCredits(controller.signal);
  const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
it("does not call the API for an already cancelled request", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(getCredits(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(api.get).not.toHaveBeenCalled();
});

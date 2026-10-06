import { describe, expect, it } from "vitest";
import { createFakeDoorMock } from "./fake-door";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";
const signal = new AbortController().signal;
const intent = { accountId: "a", flowId: "f", intentId: "i", entryPoint: "preview", catalogVersion: "mock-2026-10-05", package: DEFAULT_CREDIT_PACKAGES[0], clickedAt: "2026-10-05T00:00:00Z" };
describe("fake door preview adapter", () => {
  it("deduplicates response-loss retry and keeps exposure separate from a click", async () => {
    const mock = createFakeDoorMock({ intentFailures: 1 });
    await expect(mock.adapter.recordIntent(intent, signal)).rejects.toThrow();
    expect(mock.exposures).toHaveLength(0);
    expect(await mock.adapter.recordIntent(intent, signal)).toEqual({ audience: "first" });
    expect(mock.intents).toHaveLength(1);
    const exposure = { accountId: "a", flowId: "f", intentId: "i", exposureId: "e", shownAt: intent.clickedAt };
    await mock.adapter.recordExposure(exposure, signal);
    await mock.adapter.recordExposure(exposure, signal);
    expect(mock.exposures).toHaveLength(1);
    expect(await mock.adapter.recordIntent({ ...intent, intentId: "next" }, signal)).toEqual({ audience: "repeat" });
    expect(await mock.adapter.recordIntent({ ...intent, accountId: "b" }, signal)).toEqual({ audience: "first" });
  });
  it("rejects conflicting duplicate input and cancellation", async () => {
    const mock = createFakeDoorMock();
    await mock.adapter.recordIntent(intent, signal);
    await expect(mock.adapter.recordIntent({ ...intent, entryPoint: "changed" }, signal)).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(mock.adapter.loadCatalog(controller.signal)).rejects.toThrow();
  });
  it("exposes catalog failure for a user-driven retry", async () => {
    const mock = createFakeDoorMock({ catalogFailures: 1 });
    await expect(mock.adapter.loadCatalog(signal)).rejects.toThrow();
    expect((await mock.adapter.loadCatalog(signal)).packages).toEqual(DEFAULT_CREDIT_PACKAGES);
  });
});

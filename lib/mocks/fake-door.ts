import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";
import type { FakeDoorAdapter, FakeDoorExposure, FakeDoorIntent, FakeDoorIntentResult } from "@/lib/credits/fake-door";

/** In-memory preview only. This is NOT the BAC-89 server contract or real persistence. */
export function createFakeDoorMock(options: {
  catalogFailures?: number; intentFailures?: number; exposureFailures?: number;
  delayMs?: number; audience?: "first" | "repeat";
} = {}) {
  const intents: FakeDoorIntent[] = [];
  const exposures: FakeDoorExposure[] = [];
  const results = new Map<string, FakeDoorIntentResult>();
  let catalogFailures = options.catalogFailures ?? 0;
  let intentFailures = options.intentFailures ?? 0;
  let exposureFailures = options.exposureFailures ?? 0;
  const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, options.delayMs ?? 0);
    signal.addEventListener("abort", abort, { once: true });
  });
  const adapter: FakeDoorAdapter = {
    async loadCatalog(signal) {
      await wait(signal);
      if (catalogFailures-- > 0) throw new Error("Mock catalog unavailable");
      return { version: "mock-2026-10-05", packages: DEFAULT_CREDIT_PACKAGES };
    },
    async recordIntent(intent, signal) {
      await wait(signal);
      const key = `${intent.accountId}:${intent.intentId}`;
      const prior = intents.find((item) => item.accountId === intent.accountId && item.intentId === intent.intentId);
      if (prior && JSON.stringify(prior) !== JSON.stringify(intent)) throw new Error("Mock duplicate key conflict");
      if (!prior) {
        const audience = options.audience ?? (intents.some((item) => item.accountId === intent.accountId) ? "repeat" : "first");
        intents.push(structuredClone(intent));
        results.set(key, { audience });
      }
      // Simulate commit followed by response loss. Retrying keeps the same result.
      if (intentFailures-- > 0) throw new Error("Mock response lost");
      return results.get(key)!;
    },
    async recordExposure(exposure, signal) {
      await wait(signal);
      if (exposureFailures-- > 0) throw new Error("Mock exposure unavailable");
      if (!exposures.some((item) => item.accountId === exposure.accountId && item.exposureId === exposure.exposureId)) {
        exposures.push(structuredClone(exposure));
      }
    },
  };
  return { adapter, intents, exposures };
}

import { DEFAULT_CREDIT_PACKAGES, type CreditPackage } from "../constants/credit-packages";

export { DEFAULT_CREDIT_PACKAGES, type CreditPackage } from "../constants/credit-packages";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 3000;

function parsePackages(body: unknown): readonly CreditPackage[] | null {
  if (!body || typeof body !== "object" || !("packages" in body)) return null;
  const items = body.packages;
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return null;

  const ids = new Set<string>();
  const names = new Set<string>();
  const result: CreditPackage[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const { id, name, credits, price_krw } = item;
    if (
      typeof id !== "string" || id.trim().length === 0 || id.length > 100 ||
      typeof name !== "string" || name.trim().length === 0 || name.length > 100 ||
      !Number.isSafeInteger(credits) || credits <= 0 ||
      !Number.isSafeInteger(price_krw) || price_krw <= 0 ||
      ids.has(id.trim()) || names.has(name.trim())
    ) return null;
    ids.add(id.trim());
    names.add(name.trim());
    // Only public catalog fields enter UI state; never forward arbitrary server fields.
    result.push(Object.freeze({ id: id.trim(), name: name.trim(), credits, price_krw }));
  }
  return Object.freeze(result);
}

/** Public landing keeps its established fallback; intent screens must use strict loading. */
export async function getCreditPackages(signal?: AbortSignal): Promise<readonly CreditPackage[]> {
  try {
    return await getCreditPackagesStrict(signal);
  } catch {
    return DEFAULT_CREDIT_PACKAGES;
  }
}

/** Public catalog only; never refresh authentication or substitute prices on failure. */
export async function getCreditPackagesStrict(signal?: AbortSignal): Promise<readonly CreditPackage[]> {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const controller = new AbortController();
  let abort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => {
      controller.abort();
      reject(new DOMException("Catalog request cancelled or timed out", "AbortError"));
    };
  });
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    const request = async () => {
      const response = await fetch(`${API_URL.replace(/\/$/, "")}/credits/packages`, {
        method: "GET", credentials: "omit", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Catalog unavailable");
      const packages = parsePackages(await response.json());
      if (!packages) throw new Error("Invalid catalog");
      return packages;
    };
    return await Promise.race([request(), cancelled]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

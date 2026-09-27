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

/** Public catalog only. Do not use the authenticated client: it refreshes sessions on 401. */
export async function getCreditPackages(signal?: AbortSignal): Promise<readonly CreditPackage[]> {
  if (signal?.aborted) return DEFAULT_CREDIT_PACKAGES;

  const controller = new AbortController();
  let finishCancellation: (() => void) | undefined;
  const cancelled = new Promise<readonly CreditPackage[]>((resolve) => {
    finishCancellation = () => {
      controller.abort();
      resolve(DEFAULT_CREDIT_PACKAGES);
    };
  });
  const abort = () => finishCancellation?.();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);

  try {
    const request = async (): Promise<readonly CreditPackage[]> => {
      try {
        const response = await fetch(`${API_URL.replace(/\/$/, "")}/credits/packages`, {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return DEFAULT_CREDIT_PACKAGES;
        return parsePackages(await response.json()) ?? DEFAULT_CREDIT_PACKAGES;
      } catch {
        return DEFAULT_CREDIT_PACKAGES;
      }
    };
    // Bound both connection and response-body parsing, including implementations ignoring abort.
    return await Promise.race([request(), cancelled]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

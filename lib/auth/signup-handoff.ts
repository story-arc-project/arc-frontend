const STORAGE_KEY = "arc:signup-handoff";
const MAX_AGE_MS = 30 * 60 * 1000;

/** Tab-local, short-lived email context. Never persist passwords or auth tokens. */
export function clearSignupHandoff(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
}

export function createSignupHandoff(email: string): string | null {
  clearSignupHandoff();
  try {
    const flow = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ flow, email, createdAt: Date.now() }));
    return `/signup?step=verify&flow=${flow}`;
  } catch {
    return null;
  }
}

export function readSignupHandoff(flow: string | null): string | null {
  if (!flow) return null;
  try {
    const context: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!context || typeof context !== "object") return null;
    const value = context as Record<string, unknown>;
    if (value.flow !== flow || typeof value.email !== "string" || !value.email.trim() ||
        typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) return null;
    const age = Date.now() - value.createdAt;
    if (age < 0 || age >= MAX_AGE_MS) {
      clearSignupHandoff();
      return null;
    }
    return value.email;
  } catch {
    return null;
  }
}

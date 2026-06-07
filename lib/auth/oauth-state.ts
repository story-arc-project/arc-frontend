const COOKIE_NAME = "oauth_state";
const INTENT_COOKIE_NAME = "oauth_intent";
const MAX_AGE_SECONDS = 600;

function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${maxAge}`, "SameSite=Lax"];
  if (isSecureContext()) parts.push("Secure");
  document.cookie = parts.join("; ");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return value || null;
}

export function createOAuthState(): string {
  const state = crypto.randomUUID();
  setCookie(COOKIE_NAME, state, MAX_AGE_SECONDS);
  return state;
}

export function readOAuthState(): string | null {
  return readCookie(COOKIE_NAME);
}

export function clearOAuthState(): void {
  setCookie(COOKIE_NAME, "", 0);
}

export function setOAuthIntent(value: string): void {
  setCookie(INTENT_COOKIE_NAME, value, MAX_AGE_SECONDS);
}

export function readOAuthIntent(): string | null {
  return readCookie(INTENT_COOKIE_NAME);
}

export function clearOAuthIntent(): void {
  setCookie(INTENT_COOKIE_NAME, "", 0);
}

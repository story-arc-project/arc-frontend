const COOKIE_NAME = "oauth_state";
const MAX_AGE_SECONDS = 600;

function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

function setCookie(value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (isSecureContext()) parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function createOAuthState(): string {
  const state = crypto.randomUUID();
  setCookie(state, MAX_AGE_SECONDS);
  return state;
}

export function readOAuthState(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  return value || null;
}

export function clearOAuthState(): void {
  setCookie("", 0);
}

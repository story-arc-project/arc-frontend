const COOKIE_NAME = "oauth_state";
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

/**
 * OAuth state(CSRF 토큰)를 생성·저장하고 반환한다.
 * `prefix`를 주면 state 값에 `${prefix}:` 를 붙여 흐름 의도를 state 에 **바인딩**한다.
 * (별도 intent 쿠키를 쓰지 않는 이유: 중단된 흐름의 잔여 intent 가 이후 OAuth 콜백에
 *  누수되는 것을 막는다. state 는 매 시도마다 덮어써지고 provider 가 그대로 echo 하므로
 *  의도가 해당 요청에만 적용된다.)
 */
export function createOAuthState(prefix?: string): string {
  const token = crypto.randomUUID();
  const state = prefix ? `${prefix}:${token}` : token;
  setCookie(COOKIE_NAME, state, MAX_AGE_SECONDS);
  return state;
}

export function readOAuthState(): string | null {
  return readCookie(COOKIE_NAME);
}

export function clearOAuthState(): void {
  setCookie(COOKIE_NAME, "", 0);
}

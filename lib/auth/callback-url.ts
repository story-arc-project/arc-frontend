// 오픈 리다이렉트 방지: 동일 출처 기준으로 정규화해 상대 경로만 허용한다.
// 절대 URL(`https://evil.com`), 프로토콜 상대(`//evil.com`), 역슬래시 우회(`/\evil.com`),
// 점 세그먼트 우회(`/.//evil.com` → 정규화 시 `//evil.com`)를 모두 차단한다.
// (브라우저는 `\`를 `/`로 정규화하고 `//path`를 프로토콜 상대로 처리하므로 단순 문자열 검사로는 막을 수 없다.)
export function resolveCallbackUrl(raw: string): string {
  const fallback = "/dashboard";
  if (!raw.startsWith("/")) return fallback;
  try {
    const base = "http://localhost";
    const url = new URL(raw, base);
    // 정규화 후에도 `//`로 시작하면 location.assign이 프로토콜 상대로 해석하므로 차단한다.
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

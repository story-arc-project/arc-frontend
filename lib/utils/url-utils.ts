export function isSafeHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

/**
 * 사용자가 입력한 URL 을 그대로 anchor 에 걸어도 되는지 판정하고, 되면 **정규화한** 값을 준다.
 * 안전한 스킴이 아니거나(예: `javascript:`) 파싱되지 않으면 `null` — 호출부는 링크 대신 글자로 보인다.
 *
 * `isSafeHttpUrl` 과 달리 `mailto:` 를 허용하고 정규화 결과를 돌려준다. 첨부 계측의 중복 판정도
 * 이 정규화 결과로 해야 `https://a.dev` 와 `https://a.dev/` 가 같은 첨부로 잡힌다(FRT-113).
 *
 * ⚠️ 한 곳에만 두는 이유: 링크를 여는 자리가 늘 때(FRT-267 의 '작품 링크 / 파일' 표 셀) 스킴
 * 허용 목록이 복제되면 한쪽만 고쳐져 `javascript:` 가 통과하는 구멍이 생긴다.
 */
export function getSafeHref(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return SAFE_SCHEMES.includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

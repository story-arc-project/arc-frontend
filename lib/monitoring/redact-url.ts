// FRT-16: 관리자 고객 검색은 이메일·이름으로 조회하므로 검색어가 URL(`?q=`)에 그대로 실린다.
// Sentry 클라이언트는 `sendDefaultPii: true` + Session Replay 를 URL 스크러빙 없이 켜 두었고,
// 서버·엣지 런타임도 요청 URL 을 트랜잭션에 싣는다 — 그대로 두면 `?q=customer@example.com` 이
// 모니터링 프로젝트로 나간다(Codex P1). PostHog 의 property_denylist 는 별개 SDK 라 못 막는다.
//
// SDK 의 `dataCollection.urlQueryParams` 대신 이벤트 프로세서로 지우는 이유: `dataCollection` 을
// 지정하는 순간 기존 `sendDefaultPii` 가 **통째로 무시된다**(SDK v10 문서 명시). 이 PR 범위 밖인
// 앱 전역 수집 정책이 조용히 바뀌므로, 값만 지우는 쪽을 택했다.

const REDACTED = "[Filtered]";

/** 기본으로 가리는 파라미터. 고객 검색어. */
export const PII_QUERY_PARAMS = ["q"] as const;

/**
 * URL 문자열에서 지정한 쿼리 파라미터의 **값만** 가린다. 키는 남겨 "검색 중이었다"는 디버깅
 * 맥락은 유지한다. 상대 경로·해시·비정상 입력을 모두 원문 그대로 통과시켜, 모니터링 전송
 * 경로에서 절대 던지지 않는다.
 */
export function redactUrlQuery(
  url: string,
  params: readonly string[] = PII_QUERY_PARAMS,
): string {
  const start = url.indexOf("?");
  if (start === -1) return url;

  const head = url.slice(0, start);
  const rest = url.slice(start + 1);
  const hashAt = rest.indexOf("#");
  const rawQuery = hashAt === -1 ? rest : rest.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : rest.slice(hashAt);

  const search = new URLSearchParams(rawQuery);
  let changed = false;
  for (const p of params) {
    if (!search.has(p)) continue;
    // set 은 중복 키를 하나로 합친다 — 값이 여러 번 실려도 남는 것이 없게 한다.
    search.set(p, REDACTED);
    changed = true;
  }
  if (!changed) return url;

  return `${head}?${search.toString()}${hash}`;
}

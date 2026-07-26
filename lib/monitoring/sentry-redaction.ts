import * as Sentry from "@sentry/nextjs";

import { redactUrlQuery } from "./redact-url";

// URL 이 통째로 실리는 자리들. 브레드크럼은 내비게이션(from/to)·fetch(url), 스팬은 OTel 속성.
const BREADCRUMB_URL_KEYS = ["url", "from", "to"] as const;
const SPAN_URL_KEYS = ["http.url", "url.full", "url.query"] as const;

// Replay 이벤트만 방문 URL 목록(`urls`)을 들고 온다 — 기본 Event 타입에는 없다.
type EventWithUrls = Sentry.Event & { urls?: string[] };

/** 전체 URL 로도, `url.query` 처럼 "?" 없는 쿼리 문자열로도 올 수 있어 둘 다 받는다. */
function redactUrlOrQuery(value: string): string {
  if (value.includes("?")) return redactUrlQuery(value);
  const out = redactUrlQuery(`?${value}`);
  return out.startsWith("?") ? out.slice(1) : out;
}

function redactDataBag(
  data: unknown,
  keys: readonly string[],
): void {
  if (!data || typeof data !== "object") return;
  const bag = data as Record<string, unknown>;
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === "string") bag[key] = redactUrlOrQuery(value);
  }
}

/**
 * 나가는 모든 Sentry 이벤트에서 검색어 파라미터 값을 지운다(FRT-16 관리자 고객 검색은 이메일·
 * 이름을 URL 에 싣는다 — Codex P1). 에러·트랜잭션의 요청 URL, 백엔드 fetch 스팬의 URL,
 * 내비게이션 브레드크럼, Session Replay 의 방문 URL 목록까지 한자리에서 처리한다.
 *
 * 세 런타임(client·server·edge)이 각자 init 하므로 각 설정에서 한 번씩 부른다.
 */
export function installUrlRedaction(): void {
  Sentry.addEventProcessor((event) => {
    const e = event as EventWithUrls;

    if (e.request?.url) e.request.url = redactUrlOrQuery(e.request.url);
    if (typeof e.request?.query_string === "string") {
      e.request.query_string = redactUrlOrQuery(e.request.query_string);
    }
    if (Array.isArray(e.urls)) e.urls = e.urls.map(redactUrlOrQuery);

    redactDataBag(e.contexts?.trace?.data, SPAN_URL_KEYS);
    for (const span of e.spans ?? []) {
      redactDataBag(span.data, SPAN_URL_KEYS);
    }
    for (const crumb of e.breadcrumbs ?? []) {
      redactDataBag(crumb.data, BREADCRUMB_URL_KEYS);
    }

    return event;
  });
}

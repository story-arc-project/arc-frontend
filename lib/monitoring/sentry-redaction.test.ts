import { beforeEach, describe, expect, it, vi } from "vitest";

// addEventProcessor 로 등록되는 함수를 붙잡아 실제 이벤트를 흘려본다.
const sentry = vi.hoisted(() => ({
  processors: [] as ((event: unknown) => unknown)[],
}));

vi.mock("@sentry/nextjs", () => ({
  addEventProcessor: (fn: (event: unknown) => unknown) => {
    sentry.processors.push(fn);
  },
}));

import { installUrlRedaction } from "./sentry-redaction";

const SECRET = "hong.gildong@example.com";
const ENCODED = encodeURIComponent(SECRET);

function run(event: unknown): unknown {
  installUrlRedaction();
  const processor = sentry.processors.at(-1);
  if (!processor) throw new Error("이벤트 프로세서가 등록되지 않았다");
  return processor(event);
}

beforeEach(() => {
  sentry.processors = [];
});

describe("installUrlRedaction — 고객 검색어가 모니터링으로 새지 않는다", () => {
  it("에러 이벤트의 요청 URL·쿼리에서 검색어를 지운다", () => {
    const out = run({
      request: {
        url: `https://app.story-arc.org/admin/customers?q=${ENCODED}`,
        query_string: `q=${ENCODED}&page=2`,
      },
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
    expect(JSON.stringify(out)).not.toContain(ENCODED);
  });

  it("백엔드 fetch 스팬과 trace 컨텍스트의 URL 도 지운다", () => {
    const out = run({
      contexts: {
        trace: { data: { "url.query": `q=${ENCODED}` } },
      },
      spans: [
        {
          data: {
            "http.url": `https://api.story-arc.org/admin/customers?q=${ENCODED}`,
            "url.full": `https://api.story-arc.org/admin/customers?q=${ENCODED}`,
          },
        },
      ],
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
  });

  it("SDK 가 실제로 쓰는 fetch 스팬 키(url·http.query)도 지운다", () => {
    // @sentry/core 의 fetch 계측은 `url`(항상)·`http.url`·`http.query`(= ?로 시작하는 search)를
    // 싣는다. 실측으로 확인한 키 — 하나라도 빠지면 그 키로 검색어가 새 나간다(Codex P1).
    const out = run({
      spans: [
        {
          data: {
            url: `https://api.story-arc.org/admin/customers?q=${ENCODED}`,
            "http.query": `?q=${ENCODED}&limit=20`,
          },
        },
      ],
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
    // 검색어 외의 조회 조건은 디버깅을 위해 남아야 한다.
    expect(JSON.stringify(out)).toContain("limit=20");
  });

  it("내비게이션 브레드크럼(from/to)에서도 지운다", () => {
    const out = run({
      breadcrumbs: [
        {
          category: "navigation",
          data: {
            from: "/admin/customers",
            to: `/admin/customers?q=${ENCODED}&page=2`,
          },
        },
      ],
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
    // 같은 이벤트의 무관한 값은 살아 있어야 디버깅이 된다.
    expect(JSON.stringify(out)).toContain("page=2");
  });

  it("Session Replay 의 방문 URL 목록에서도 지운다", () => {
    const out = run({
      type: "replay_event",
      urls: [
        "/admin/customers",
        `/admin/customers?q=${ENCODED}`,
      ],
    }) as { urls: string[] };

    expect(out.urls[0]).toBe("/admin/customers");
    expect(out.urls[1]).not.toContain("hong.gildong");
  });

  it("Referer 헤더와 그 스팬 속성에서도 지운다", () => {
    // 앱 전역 Referrer-Policy: strict-origin 이 1차 방어지만, 헤더가 되살아나도 새지 않게 한다.
    const out = run({
      request: {
        headers: { Referer: `https://app.story-arc.org/admin/customers?q=${ENCODED}` },
      },
      contexts: {
        trace: {
          data: {
            "http.request.header.referer": `https://app.story-arc.org/admin/customers?q=${ENCODED}`,
          },
        },
      },
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
  });

  it("콘솔 브레드크럼의 메시지·인자에서도 지운다", () => {
    // NEXT_PUBLIC_API_DEBUG 로거가 요청 경로를 통째로 찍으면 Sentry 가 브레드크럼으로 실어간다.
    const out = run({
      breadcrumbs: [
        {
          category: "console",
          message: `[API →] GET /admin/customers?q=${ENCODED}`,
          data: {
            arguments: [`[API ←] 200 GET /admin/customers?q=${ENCODED}`],
          },
        },
      ],
    });

    expect(JSON.stringify(out)).not.toContain("hong.gildong");
  });

  it("검색어가 없는 평범한 이벤트는 건드리지 않는다", () => {
    const event = {
      request: { url: "https://app.story-arc.org/dashboard" },
      breadcrumbs: [{ data: { to: "/archive?page=2" } }],
    };
    const out = run(event) as typeof event;

    expect(out.request.url).toBe("https://app.story-arc.org/dashboard");
    expect(out.breadcrumbs[0].data.to).toBe("/archive?page=2");
  });

  it("URL 자리가 비었거나 형식이 달라도 던지지 않는다", () => {
    expect(() =>
      run({ request: {}, spans: [{ data: null }], breadcrumbs: [{}] }),
    ).not.toThrow();
  });
});

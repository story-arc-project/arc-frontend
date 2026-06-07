// ─────────────────────────────────────────────────────────────
// E2E API stub helper (FRT-28 · FRT-42)
//
// `NEXT_PUBLIC_API_URL` origin 으로 나가는 **데이터 엔드포인트** 요청을 `page.route`
// 로 가로채 결정론적으로 fulfill 한다. 백엔드 없이도 `(main)` 화면을 검증하기 위한
// 토대다 (소비처: FRT-30 스모크).
//
// FRT-42 확장 — Stateful mock:
//   experiences · bookmarks · resume(export) 의 변이(POST/PUT/PATCH/DELETE)가
//   **인메모리 상태**(stateful-store)를 바꾸고 이후 GET 이 반영한다. 그 외 엔드포인트
//   (libraries/presets/analysis 목록·상세·status)는 변이 대상이 아니라 정적 GET 으로
//   둔다. store 는 `stubApi` 호출마다 새로 만들어져 테스트 간 격리된다(전역 누수 0).
//
// 사용:
//   import { stubApi } from "./fixtures/stub-api";
//   const stub = await stubApi(page);            // 기본 "data" 시나리오
//   await stubApi(page, { scenario: "empty" });
//   await page.goto("/dashboard");               // ← 반드시 stubApi 이후에 호출
//   // 변이 payload 단언(FRT-42):
//   expect(stub.mutations).toContainEqual(...);
//
// ⚠️ 반드시 `page.goto` **이전**에 등록한다. 그렇지 않으면 화면 로드 시점의
//    on-load fetch 가 스텁을 거치지 않고 실제 네트워크로 샌다.
//
// CORS: 앱은 localhost:3000 → :8000 으로 credentialed cross-origin fetch 를 한다.
//       fulfill 응답에 `access-control-allow-origin`(정확한 origin) +
//       `access-control-allow-credentials: true` 를 실어야 브라우저가 응답을 읽는다.
//       비-GET(변이) 응답에도 동일 CORS·봉투를 싣는다.
//
// 인증: 기본값은 비인증(`/auth/me` → 404)이라 `/landing` 등 공개 화면 스펙(FRT-28)은
// 영향받지 않는다. `{ authed: true }` 를 줄 때만 `/auth/me` 를 고정 사용자(seedDemoUser)로
// fulfill 해, 빌드타임 정적 플래그(`NEXT_PUBLIC_E2E_AUTH`) 없이도 `(main)` 진입을 검증한다.
// ─────────────────────────────────────────────────────────────

import type { Page, Request, Route } from "@playwright/test";

import type {
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience";
import type { AnalysisSnapshot } from "@/types/analysis";
import type { ResumeLanguage, ResumeVersion } from "@/types/resume";
import { seedDemoUser } from "@/lib/demo/seed";

import { API_ORIGIN } from "./api-origin";
import {
  type StubScenario,
  analysisStatus,
  comprehensiveDetail,
  comprehensiveList,
  individualDetail,
  individualList,
  keywordDetail,
  keywordList,
  libraryExperiences,
  libraryList,
  presetList,
  success,
} from "./api-data";
import { type StatefulStore, createStatefulStore } from "./stateful-store";

export type { StubScenario };

/**
 * 테스트가 가로채는 백엔드 origin. `playwright.config.ts` 가 dev 서버에 주입하는
 * `NEXT_PUBLIC_API_URL` 과 **동일 상수**(api-origin)를 공유한다.
 *
 * 러너 프로세스의 `process.env.NEXT_PUBLIC_API_URL` 을 읽지 않는 이유: 그 값이
 * config 가 dev 서버에 주입한 값과 다르면, 앱은 :8000 으로 fetch 하는데 스텁은
 * 다른 origin 을 가로채 실제 백엔드로 새고(계약 스펙만 거짓 통과) 만다. (Codex P2)
 */
export const STUB_API_URL = API_ORIGIN;

const DEFAULT_PAGE_ORIGIN = "http://localhost:3000";

interface RouteDef {
  /** pathname 정규식 (앵커링되어 상호 배타적). */
  match: RegExp;
  /** scenario 에 맞는 응답 본문(이미 봉투/형태가 맞춰진 값)을 반환. */
  build: (scenario: StubScenario) => unknown;
}

// 정적 GET 라우트 테이블 (변이 대상이 아닌 엔드포인트). 각 정규식은 `^…$` 앵커링되어
// 목록/상세가 겹치지 않는다. experiences·bookmarks·resume 은 stateful 라우터가 다룬다.
// analysis 목록(individual/comprehensive/keyword)도 isBookmarked 플래그를 라이브 북마크
// 상태와 동기화하려 stateful 라우터에서 다룬다(상세·status 는 정적 유지).
const GET_ROUTES: RouteDef[] = [
  { match: /^\/libraries\/$/, build: libraryList },
  { match: /^\/libraries\/[^/]+\/experiences$/, build: libraryExperiences },

  { match: /^\/presets\/$/, build: presetList },

  { match: /^\/analysis\/individual\/[^/]+$/, build: individualDetail },
  { match: /^\/analysis\/comprehensive\/[^/]+$/, build: comprehensiveDetail },
  { match: /^\/analysis\/keyword\/[^/]+$/, build: keywordDetail },
  { match: /^\/analysis\/status\/[^/]+$/, build: analysisStatus },
];

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
  };
}

function parseBody(req: Request): unknown {
  const raw = req.postData();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resumeLanguage(body: unknown): ResumeLanguage {
  const lang = (body as { language?: unknown } | undefined)?.language;
  return lang === "en" ? "en" : "ko";
}

// ─── Stateful 라우팅 ─────────────────────────────────────────
// experiences · bookmarks · resume 의 GET 과 변이를 store 로 처리한다.
// respond → 즉시 fulfill, notfound → 표준 404, skip → (정적 GET / 최종 404)으로 위임.

type StatefulResult =
  | { kind: "respond"; status: number; payload: unknown }
  | { kind: "notfound" }
  | { kind: "skip" };

const RESPOND_OK = (payload: unknown): StatefulResult => ({
  kind: "respond",
  status: 200,
  payload,
});

/** 분석 목록 스냅샷의 isBookmarked 를 라이브 북마크 상태로 덮어쓴다. */
function withBookmarkFlags(
  snapshots: AnalysisSnapshot[],
  store: StatefulStore,
): AnalysisSnapshot[] {
  return snapshots.map((s) => ({
    ...s,
    isBookmarked: store.bookmarks.isBookmarked(s.id),
  }));
}

function routeStateful(
  method: string,
  pathname: string,
  body: unknown,
  store: StatefulStore,
  scenario: StubScenario,
): StatefulResult {
  // experiences 목록 / 생성
  if (/^\/experiences\/$/.test(pathname)) {
    if (method === "GET") return RESPOND_OK(success(store.experiences.list()));
    if (method === "POST") {
      const id = store.experiences.create(body as ExperienceSavePayload);
      return RESPOND_OK(success({ id }));
    }
    return { kind: "notfound" };
  }

  // experiences 복제 (POST /experiences/:id/duplicate)
  const expDuplicate = pathname.match(/^\/experiences\/([^/]+)\/duplicate$/);
  if (expDuplicate) {
    if (method === "POST") {
      const newId = store.experiences.duplicate(expDuplicate[1]);
      return newId ? RESPOND_OK(success({ id: newId })) : { kind: "notfound" };
    }
    return { kind: "notfound" };
  }

  // experiences 상세 / 수정 / 삭제
  const expItem = pathname.match(/^\/experiences\/([^/]+)$/);
  if (expItem) {
    const id = expItem[1];
    if (method === "GET") {
      const exp = store.experiences.get(id);
      return exp ? RESPOND_OK(success(exp)) : { kind: "notfound" };
    }
    if (method === "PUT") {
      const ok = store.experiences.update(id, body as ExperienceUpdatePayload);
      return ok ? RESPOND_OK(success(null)) : { kind: "notfound" };
    }
    if (method === "DELETE") {
      store.experiences.remove(id); // 멱등
      return RESPOND_OK(success(null));
    }
    return { kind: "notfound" };
  }

  // bookmarks 목록
  if (/^\/analysis\/bookmarks$/.test(pathname)) {
    if (method === "GET") return RESPOND_OK(success(store.bookmarks.list()));
    return { kind: "notfound" };
  }

  // bookmark 추가 / 제거
  const bookmarkItem = pathname.match(/^\/analysis\/bookmarks\/([^/]+)$/);
  if (bookmarkItem) {
    const id = bookmarkItem[1];
    if (method === "POST") {
      // 알 수 없는 분석 id 는 404(실계약 충실 + 테스트 작성 오류 노출).
      return store.bookmarks.add(id) ? RESPOND_OK(success(null)) : { kind: "notfound" };
    }
    if (method === "DELETE") {
      store.bookmarks.remove(id); // 멱등
      return RESPOND_OK(success(null));
    }
    return { kind: "notfound" };
  }

  // analysis 목록 — 정적 픽스처에 라이브 isBookmarked 를 덮어쓴다(상세·status 는 정적).
  if (/^\/analysis\/individual$/.test(pathname)) {
    if (method === "GET")
      return RESPOND_OK(success(withBookmarkFlags(individualList(scenario).data, store)));
    return { kind: "skip" };
  }
  if (/^\/analysis\/comprehensive$/.test(pathname)) {
    if (method === "GET")
      return RESPOND_OK(success(withBookmarkFlags(comprehensiveList(scenario).data, store)));
    return { kind: "skip" };
  }
  if (/^\/analysis\/keyword$/.test(pathname)) {
    if (method === "GET")
      return RESPOND_OK(success(withBookmarkFlags(keywordList(scenario).data, store)));
    return { kind: "skip" };
  }

  // resume 목록 / 생성
  if (/^\/export\/resume$/.test(pathname)) {
    if (method === "GET") return RESPOND_OK(success(store.resume.getList()));
    if (method === "POST") {
      return RESPOND_OK(success(store.resume.create(resumeLanguage(body))));
    }
    return { kind: "notfound" };
  }

  // resume 상세 / 수정 / 삭제
  const resumeItem = pathname.match(/^\/export\/resume\/([^/]+)$/);
  if (resumeItem) {
    const id = resumeItem[1];
    if (method === "GET") {
      const version = store.resume.getVersion(id);
      return version ? RESPOND_OK(success(version)) : { kind: "notfound" };
    }
    if (method === "PATCH") {
      const updated = store.resume.update(id, body as ResumeVersion);
      return updated ? RESPOND_OK(success(updated)) : { kind: "notfound" };
    }
    if (method === "DELETE") {
      store.resume.remove(id); // 멱등
      return RESPOND_OK(success(null));
    }
    return { kind: "notfound" };
  }

  return { kind: "skip" };
}

export interface StubApiOptions {
  /** "data"(기본): 채워진 응답 · "empty": 빈 목록으로 빈 상태 검증. */
  scenario?: StubScenario;
  /**
   * true 면 `GET /auth/me` 를 고정 사용자(seedDemoUser, onboarded)로 fulfill 해
   * `(main)` 진입 가드(AuthGate)를 통과시킨다. 기본 false(미인증 → 404)라
   * `/landing` 등 공개 화면 스펙은 영향받지 않는다.
   */
  authed?: boolean;
}

/** OPTIONS·GET 을 제외한, 앱이 보낸 변이 요청을 도착 순서대로 캡처한다(payload 단언용). */
export interface CapturedMutation {
  method: string;
  /** 요청 pathname (origin 제외). */
  path: string;
  /** 파싱된 JSON body. body 없는 변이(예: 북마크 POST)는 undefined. */
  body: unknown;
}

export interface StubApiHandle {
  /** 변이(비-GET·비-OPTIONS) 요청 캡처. 테스트가 액션 후 읽어 payload 를 단언한다. */
  mutations: CapturedMutation[];
}

/**
 * 데이터 엔드포인트 스텁을 페이지에 등록한다. `page.goto` 이전에 호출할 것.
 * 반환된 핸들의 `mutations` 로 앱이 보낸 변이 payload 를 단언할 수 있다.
 */
export async function stubApi(
  page: Page,
  options: StubApiOptions = {},
): Promise<StubApiHandle> {
  const scenario: StubScenario = options.scenario ?? "data";
  const authed = options.authed ?? false;

  // 테스트별 fresh store (이 클로저에만 상태가 존재 → 전역 누수 0).
  const store = createStatefulStore(scenario);
  const mutations: CapturedMutation[] = [];
  let accountDeleted = false;

  await page.route(
    (url) => url.href.startsWith(STUB_API_URL),
    async (route: Route) => {
      const req = route.request();
      const method = req.method();
      const origin = req.headers()["origin"] ?? DEFAULT_PAGE_ORIGIN;

      // CORS preflight: 데이터 응답과 동일 origin 정책으로 통과시킨다.
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            ...corsHeaders(origin),
            "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
        return;
      }

      const pathname = new URL(req.url()).pathname;

      // 변이 요청 캡처(payload 단언용). store 변경 이전에 body 를 기록한다.
      // (OPTIONS 는 위에서 early-return 되므로 여기 도달하지 않는다.)
      let body: unknown;
      if (method !== "GET") {
        body = parseBody(req);
        mutations.push({ method, path: pathname, body });
      }

      const fulfillJson = (status: number, payload: unknown) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: corsHeaders(origin),
          body: JSON.stringify(payload),
        });

      const notFound = () =>
        fulfillJson(404, {
          status: "error",
          message: `E2E stub: unstubbed ${method} ${pathname}`,
          code: "E2E_STUB_NOT_FOUND",
        });

      // 인증 주입(opt-in): `/auth/me` 를 고정 사용자로 fulfill 해 AuthGate 를 통과시킨다.
      // fetchCurrentUser 는 응답 봉투의 `.data` 를 읽으므로 `{ data: user }` 형태로 싼다.
      if (method === "GET" && authed && pathname === "/auth/me") {
        // 계정 삭제(FRT-9) 후에는 세션이 사라진 것처럼 401 을 돌려준다.
        if (accountDeleted) {
          await fulfillJson(401, { status: "error", message: "deleted", code: "UNAUTHORIZED" });
          return;
        }
        await fulfillJson(200, success(seedDemoUser));
        return;
      }

      // 계정 삭제(FRT-9): 성공 후 /auth/me 가 401 이 되도록 플래그를 세운다.
      if (
        method === "DELETE" &&
        (pathname === "/auth/account/password" || pathname === "/auth/account/social")
      ) {
        accountDeleted = true;
        await fulfillJson(200, success(null));
        return;
      }

      // experiences · bookmarks · resume · analysis 목록 → stateful 라우터.
      const result = routeStateful(method, pathname, body, store, scenario);
      if (result.kind === "respond") {
        await fulfillJson(result.status, result.payload);
        return;
      }
      if (result.kind === "notfound") {
        await notFound();
        return;
      }

      // 그 외 정적 GET 라우트.
      if (method === "GET") {
        const def = GET_ROUTES.find((r) => r.match.test(pathname));
        if (def) {
          await fulfillJson(200, def.build(scenario));
          return;
        }
      }

      // 미정의 엔드포인트 / 비-GET: 실제 네트워크로 새지 않도록 명시적 404.
      await notFound();
    },
  );

  return { mutations };
}

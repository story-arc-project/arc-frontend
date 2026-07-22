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

export const DEFAULT_PAGE_ORIGIN = "http://localhost:3000";

/** 피드백 응답 저장 시각(FRT-96). 고정값이라 스냅샷·단언이 시간에 흔들리지 않는다. */
const FEEDBACK_RESPONDED_AT = "2026-03-02T09:00:00.000Z";

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

/**
 * 스텁 응답에 반드시 실어야 하는 CORS 헤더. 스펙이 특정 경로만 국소적으로 덮을 때도(FRT-96
 * `stubExperienceCount`) 이 함수를 재사용해야, CORS 계약이 바뀔 때 한 곳만 고치면 된다.
 */
export function corsHeaders(origin: string): Record<string, string> {
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
    // 종합 분석 생성(FRT-96). 폴링(useAnalysisPolling)은 **목록에서** 이 id 를 찾아 상태를 읽으므로,
    // 새 id 를 만들어 주면 목록에 없어 "결과를 찾을 수 없습니다" 로 끝난다. 시드에 이미 있는
    // comp-1(status: completed)을 돌려줘 완료 흐름이 첫 폴링에 닫히게 한다.
    if (method === "POST") return RESPOND_OK(success({ id: "comp-1" }));
    return { kind: "skip" };
  }
  if (/^\/analysis\/keyword$/.test(pathname)) {
    if (method === "GET")
      return RESPOND_OK(success(withBookmarkFlags(keywordList(scenario).data, store)));
    return { kind: "skip" };
  }

  // resume 목록 / 생성 — 백엔드 계약: 목록은 { count, contents }, 생성은 큐잉만 하고 data 없음.
  if (/^\/export\/resume$/.test(pathname)) {
    if (method === "GET") {
      const items = store.resume.getList();
      return RESPOND_OK(
        success({
          count: items.length,
          contents: items.map((item) => ({
            id: item.version_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })),
        }),
      );
    }
    if (method === "POST") {
      store.resume.create(resumeLanguage(body));
      return RESPOND_OK({
        status: "success",
        message: "Resume generation queued successfully.",
      });
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
  /**
   * `authed: true` 와 함께 사용. false 를 지정하면 `/auth/me` 응답의 `onboarded` 필드를
   * false 로 덮어써 온보딩 미완료 인증 사용자를 시뮬레이션한다.
   * 기본값은 seedDemoUser 의 값(true)을 그대로 사용하므로 기존 스펙에 영향 없음.
   */
  onboarded?: boolean;
  /**
   * `authed: true` 와 함께 사용. false 를 지정하면 `/auth/me` 응답의 `account.has_password` 를
   * false(+소셜 연결)로 덮어써 소셜 전용 계정을 시뮬레이션한다(FRT-49 설정發 재설정 게이팅 검증).
   * 기본값은 seedDemoUser(true)를 그대로 사용한다.
   */
  hasPassword?: boolean;
  /**
   * 인앱 피드백(FRT-96) 엔드포인트를 응답할지. **기본 false** — 주지 않으면 prompt-shown 이
   * 404 로 떨어지고, 훅(useFeedbackPrompt)이 fail-closed 라 모달이 뜨지 않는다.
   *
   * ⚠️ 이 opt-in 이 필요한 이유: `NEXT_PUBLIC_FEEDBACK_ENABLED` 는 dev 서버 기동 env 라
   * playwright.config 에서 **전역으로** 켜진다. 노출 게이트의 나머지 한 겹인 "서버가 200 을
   * 주느냐" 를 여기서 스펙별로 잠가야, 트리거 조건(경험 임계 등)이 나중에 바뀌어도 무관한
   * 스펙에 모달이 새지 않는다. 시드 개수에 기대는 우연한 안전과는 다르다.
   */
  feedback?: boolean;
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
  const onboardedOverride = options.onboarded;
  const hasPasswordOverride = options.hasPassword;
  const feedback = options.feedback ?? false;

  // 테스트별 fresh store (이 클로저에만 상태가 존재 → 전역 누수 0).
  const store = createStatefulStore(scenario);
  const mutations: CapturedMutation[] = [];
  let accountDeleted = false;
  // 비밀번호 재설정(FRT-49): 재설정 성공 후 기존 세션이 무효화된 것처럼 /auth/me 가 401 이 되게 한다.
  let sessionInvalidated = false;
  // 프로필 수정(FRT-21): PATCH 로 받은 변경분을 누적해 이후 /auth/me 가 반영하게 한다.
  let profilePatch: Record<string, unknown> = {};
  // 인앱 피드백(FRT-96): 노출 기록이 남은 캠페인. 서버의 unique(user_id, campaign_id) +
  // ON CONFLICT DO NOTHING 을 모사한다 — 첫 POST 만 created:true, 이후는 false.
  // 페이지를 새로 열어도(=훅 재마운트) 모달이 다시 뜨지 않는 것은 오직 이 서버 판정이 보장한다.
  const promptShownCampaigns = new Set<string>();

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
        // 계정 삭제(FRT-9)·비밀번호 재설정(FRT-49) 후에는 세션이 사라진 것처럼 401 을 돌려준다.
        if (accountDeleted || sessionInvalidated) {
          await fulfillJson(401, { status: "error", message: "deleted", code: "UNAUTHORIZED" });
          return;
        }
        // onboarded: false 옵션 — 온보딩 미완료 사용자(소셜 콜백/이메일 인증 직후)를 시뮬레이션.
        // 프로필 수정(FRT-21)으로 누적된 변경분을 profile 에 병합해 refetch 가 갱신을 반영하게 한다.
        const meUser = {
          ...seedDemoUser,
          ...(onboardedOverride === false ? { onboarded: false } : {}),
          account:
            hasPasswordOverride === false
              ? { ...seedDemoUser.account, has_password: false, connected_oauth: ["google"] }
              : seedDemoUser.account,
          profile: seedDemoUser.profile
            ? { ...seedDemoUser.profile, ...profilePatch }
            : seedDemoUser.profile,
        };
        await fulfillJson(200, success(meUser));
        return;
      }

      // 프로필 수정(FRT-21): PATCH /auth/profile — 변경분을 누적하고 성공을 돌려준다.
      if (method === "PATCH" && pathname === "/auth/profile") {
        profilePatch = { ...profilePatch, ...(body as Record<string, unknown>) };
        await fulfillJson(200, success(null));
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

      // 동의 제출(FRT-5): 온보딩 consent 스텝 POST.
      if (method === "POST" && pathname === "/auth/consent") {
        await fulfillJson(200, success(null));
        return;
      }

      // 비밀번호 재설정(FRT-8): forgot → verify → reset.
      // 코드 "000000" 은 무효 코드로 취급해 검증 실패 분기를 결정론적으로 노출한다.
      if (method === "POST" && pathname === "/auth/forgot-password") {
        await fulfillJson(200, success(null));
        return;
      }
      if (method === "POST" && pathname === "/auth/reset-password/verify") {
        const code = (body as { code?: string } | undefined)?.code;
        if (code === "000000") {
          await fulfillJson(400, { status: "error", message: "invalid code", code: "INVALID_CODE" });
          return;
        }
        await fulfillJson(200, success(null));
        return;
      }
      if (method === "POST" && pathname === "/auth/reset-password") {
        // 재설정 성공 → 기존 세션 무효화(설정發 흐름의 재로그인 유도를 모델링).
        sessionInvalidated = true;
        await fulfillJson(200, success(null));
        return;
      }

      // 로그아웃(FRT-49 설정發 재설정의 세션 정리 포함): /auth/me 가 401 이 되게 한다.
      if (method === "POST" && pathname === "/auth/logout") {
        // reset-password 가 이미 세션을 무효화했다면 쿠키가 없어 401 — 실제 백엔드 동작을 모델링.
        if (sessionInvalidated) {
          await fulfillJson(401, { status: "error", message: "no session", code: "UNAUTHORIZED" });
          return;
        }
        sessionInvalidated = true;
        await fulfillJson(200, success(null));
        return;
      }

      // 토큰 갱신: 세션이 무효화된 뒤엔 refresh 토큰도 무효 → 401(재인증 필요).
      // (api client 가 401 응답에 대해 /auth/refresh 를 시도하므로, 무효 세션을 정확히 모델링한다.)
      if (method === "POST" && pathname === "/auth/refresh" && (sessionInvalidated || accountDeleted)) {
        await fulfillJson(401, { status: "error", message: "no session", code: "UNAUTHORIZED" });
        return;
      }

      // 인앱 피드백(FRT-96) — `feedback: true` 를 준 스펙에서만 응답한다. 옵션이 없으면 이 블록을
      // 그대로 지나쳐 아래 404 로 떨어지고, 훅이 fail-closed 라 모달이 뜨지 않는다.
      if (feedback && method === "POST") {
        const promptShown = pathname.match(
          /^\/feedback\/campaigns\/([^/]+)\/prompt-shown$/,
        );
        if (promptShown) {
          const campaignId = promptShown[1];
          // 노출 기록이 이번에 생겼는가 = 모달을 띄울까. 판정은 서버가 원자적으로 내린다(계약 §3).
          const created = !promptShownCampaigns.has(campaignId);
          promptShownCampaigns.add(campaignId);
          await fulfillJson(200, success({ created }));
          return;
        }
        if (/^\/feedback\/campaigns\/[^/]+\/responses$/.test(pathname)) {
          await fulfillJson(200, success({ responded_at: FEEDBACK_RESPONDED_AT }));
          return;
        }
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

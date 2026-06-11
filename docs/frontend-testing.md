# Frontend Testing — ARC

> 프론트엔드에서 **언제·어떤 테스트를 추가하는지**의 정본 문서.
> 개발 워크플로(루트 `CLAUDE.md` → **Development Workflow / #4 Implement**)는 이 문서의
> [테스트 전략 매트릭스](#3-테스트-전략-매트릭스)를 참조한다. 충돌 시 `CLAUDE.md`가 우선한다.

---

## 0. 배경 (이 문서가 생긴 이유)

**FRT Test Foundation** 프로젝트로 Storybook · Playwright E2E · Vitest 세 층의
테스트 기반이 갖춰졌다. 이에 맞춰 TDD를 *"모든 변경에 전면 RED-GREEN 의무"* 가 아니라
**변경 종류별 전략 매트릭스**로 활성화한다 — 프론트엔드 작업의 상당수는 시각/상호작용이라
유닛 TDD 한 가지로 묶는 게 비현실적이기 때문이다.

> **2차(실 백엔드 통합 E2E)는 보류:** 실제 테스트 백엔드 + 테스트 DB seed 기반 통합 E2E
> 설계(FRT-33)는 **백엔드 계약이 안정화된 뒤로 deferred**. 그때까지 FE 회귀는
> 고정 스텁 스모크 + Vitest 유닛(매퍼·방어 파싱)으로 커버한다.

---

## 1. 테스트 3층 개요

| 층 | 무엇을 검증 | 도구 | 대상 위치 | API 모킹 방식 |
|---|---|---|---|---|
| **Storybook** | 컴포넌트 상태·시각·인터랙션 QA | `@storybook/nextjs` + test-runner | `components/**/*.stories.tsx` | **MSW** (`lib/mocks/handlers.ts`) |
| **Playwright E2E** | `(main)` 화면 진입·사용자 흐름 | `@playwright/test` | `e2e/*.spec.ts` | `page.route` 스텁 (`e2e/fixtures/`) |
| **Vitest** | 순수 로직·매퍼·방어 파싱 | `vitest` + jsdom | `**/*.test.{ts,tsx}` | 모킹 거의 불필요 (순수 함수) |

세 층 모두 **백엔드 없이 결정론적으로** 돌도록 설계됐다(스텁/MSW). 실 백엔드는 띄우지 않는다.

---

## 2. 로컬 실행

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (E2E가 자동 기동하므로 E2E 돌릴 땐 따로 안 띄워도 됨) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` 타입 체크 |
| `npm run test:unit` | Vitest 1회 실행 |
| `npm run test:unit:watch` | Vitest watch 모드 |
| `npm run storybook` | Storybook dev 서버 (`localhost:6006`) |
| `npm run build-storybook` | Storybook 정적 빌드 |
| `npm run test-storybook` | (Storybook이 떠 있는 상태에서) test-runner — 모든 스토리 마운트 + `play` 실행 |
| `npm run test-storybook:ci` | 빌드→정적 서빙→test-runner를 한 번에 (CI와 동일) |
| `npm run test:e2e` | Playwright E2E (dev 서버 자동 기동) |
| `npm run test:e2e:ui` | Playwright UI 모드 (디버깅) |
| `npm run test:e2e:report` | 마지막 실행 리포트 열기 |

> Playwright는 최초 1회 `pretest:e2e` 훅이 chromium을 설치한다. CI는 OS 의존성까지 필요해
> `npx playwright install --with-deps chromium`을 별도로 실행한다.

---

## 3. 테스트 전략 매트릭스

**변경 종류에 따라 1차 방어 도구와 TDD 강도를 정한다.** `(main)` 진입 스모크와 로직 유닛은
의무, 시각/스타일은 테스트 추가 불필요다.

| 변경 종류 | 예시 위치 | 1차 방어 도구 | TDD 강도 |
|---|---|---|---|
| 순수 로직·매퍼·파싱·유틸 | `lib/utils/*`, `lib/api/*`(파싱) | **Vitest 유닛** | **RED → GREEN → REFACTOR 의무** |
| API 클라이언트·방어 파싱 | `lib/api/client.ts`, `*-api.ts` | **Vitest 유닛** | **의무** (계약 변화 회귀 가드) |
| 순수 커스텀 훅(로직 위주) | `hooks/*` | Vitest (+ testing-library) | RED-GREEN 권장 |
| 표현형 컴포넌트 (props → UI) | `components/**` | **Storybook** story (+ `play`) | **스토리 의무** (RED-GREEN은 아님) |
| 사용자 흐름·라우트·CRUD | `app/(main)/**` | **Playwright E2E** | **`(main)` 진입 스모크 의무** |
| 순수 스타일·레이아웃 | className / Tailwind | Storybook 시각 확인 | 테스트 추가 불필요 |

**"TDD 의무"의 의미** — 해당 행에선 *구현 전에 실패하는 Vitest 테스트를 먼저 쓴다*
(RED → 구현으로 GREEN → 리팩토링). 매퍼·방어 파싱처럼 백엔드 계약을 가정하는 코드는
계약이 바뀌면 깨지도록 회귀 가드를 남기는 게 핵심이다.

**신규 컴포넌트/페이지**는 위와 별개로 `CLAUDE.md`의 **UI Spec 상태 매트릭스**
(loading / error / empty / partial × 컴포넌트)를 먼저 정의하고, 그 상태들을 Storybook
스토리로 표현한다.

---

## 4. Storybook — 스토리 작성

### 4.1 위치·네이밍
- 파일은 컴포넌트 **옆**에 둔다: `components/<area>/<Component>.stories.tsx`
  (glob: `components/**/*.stories.@(ts|tsx)`).
- `title`은 트리 경로다: UI primitive → `"UI/Button"`, 기능 컴포넌트 → `"Features/Analysis/BookmarkToggle"`.

### 4.2 기본 형태 (`Meta` / `StoryObj`)
```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "destructive"] },
  },
  args: { children: "버튼", variant: "primary" },
};
export default meta;

type Story = StoryObj<typeof Button>;
export const Primary: Story = { args: { variant: "primary" } };
```
variant가 많으면 `render`로 한 스토리에 나란히 배치한다(예: `button.stories.tsx`의 `Sizes`).

### 4.3 API 모킹 — MSW (`__mocks__` 아님)
컴포넌트가 `fetch`/API를 호출하면 **MSW**가 가로챈다(`msw-storybook-addon`).
- **전역 핸들러**: `lib/mocks/handlers.ts`의 `defaultHandlers`가 `.storybook/preview.ts`에
  등록돼 모든 스토리에 적용된다.
- **가로채지 않은** 백엔드 origin 요청은 `preview.ts`의 `onUnhandledRequest`가
  `console.error`로 표면화 → test-runner의 `--failOnConsole`이 **실패로 처리**한다.
  즉 새 API를 부르는 컴포넌트는 핸들러를 반드시 추가해야 스토리가 통과한다.
- **스토리별 override**: 그 스토리에서만 다른 응답이 필요하면 `parameters.msw.handlers`:
```tsx
import { http, HttpResponse } from "msw";

export const WithError: Story = {
  parameters: {
    msw: { handlers: [http.get("*/some/endpoint", () => new HttpResponse(null, { status: 500 }))] },
  },
};
```

### 4.4 인터랙션 테스트 (`play`)
클릭·입력 등 동작 검증은 `play`에서 `storybook/test`의 `userEvent`/`within`/`expect`/`fn`을 쓴다:
```tsx
import { expect, fn, userEvent, within } from "storybook/test";

export const TogglesOn: Story = {
  args: { isBookmarked: false, onToggled: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기" }));
    await canvas.findByRole("button", { name: "즐겨찾기 해제" });
    await expect(args.onToggled).toHaveBeenCalledWith(true);
  },
};
```

### 4.5 새 스토리 추가 체크리스트
1. `components/<area>/<Component>.stories.tsx` 생성, `title` 트리 경로 지정.
2. 핵심 variant/상태마다 named export(`Primary`, `Empty`, `Error`…).
3. API를 호출하면 `lib/mocks/handlers.ts`에 핸들러 추가(또는 스토리 `parameters.msw`).
4. 동작이 있으면 `play`로 인터랙션 검증.
5. `npm run storybook`으로 눈으로 확인 → `npm run test-storybook`으로 게이트 통과 확인.

---

## 5. Playwright E2E — 스모크/동작 추가

### 5.1 동작 방식
`playwright.config.ts`가 `npm run dev`로 앱을 기동하고 `NEXT_PUBLIC_API_URL`
(= `http://localhost:8000`, `e2e/fixtures/api-origin.ts`)를 주입한다. 테스트는
`page.route`로 그 origin의 모든 API를 **스텁**한다 — 실 백엔드는 띄우지 않는다.
- `baseURL`: `http://localhost:3000`, `testDir`: `e2e/`, 브라우저: chromium.
- 로컬: 기존 dev 서버 재사용, retries=0. CI: 서버 새로 기동, **workers=1, retries=2**.

### 5.2 인증 — 런타임 `/auth/me` 스텁 (빌드 플래그 아님)
인증은 **스펙별 런타임 스텁**으로 주입한다. `stubApi(page, { authed: true })`를 호출하면
`AuthContext → fetchCurrentUser()`가 부르는 `GET /auth/me`를 가로채 고정 사용자를 반환한다.

> ⚠️ `NEXT_PUBLIC_E2E_AUTH` 빌드 플래그(`lib/api/auth-api.ts`)도 존재하지만 **테스트에선
> 의도적으로 쓰지 않는다.** 잡 전역으로 켜면 `fetchCurrentUser`가 *항상* 인증 사용자를
> 반환해, 공개 화면 스펙(`smoke.spec.ts`의 `/landing`)이 `useRedirectIfAuthenticated`로
> `/dashboard`에 튕겨 깨진다. **인증이 필요한 스펙만** `authed: true`로 켠다.

### 5.3 API 스텁 fixtures (`e2e/fixtures/`)
| 파일 | 역할 |
|---|---|
| `api-origin.ts` | 백엔드 origin 상수 (`http://localhost:8000`) — config·스텁이 공유 |
| `api-data.ts` | 엔드포인트별 **고정 응답 시드**. 시나리오: `"data"` \| `"empty"` |
| `stateful-store.ts` | 변이(CRUD)를 **테스트별 메모리**에 반영(experiences·bookmarks·resume). 병렬 안전 |
| `stub-api.ts` | `page.route` 인터셉트 등록 + 변이 payload 캡처 핸들 반환 |

`stubApi`의 핵심 시그니처:
```ts
await stubApi(page, { scenario?: "data" | "empty", authed?: boolean }): Promise<StubApiHandle>
// handle.mutations: { method, path, body }[]  — 도착 순서대로 캡처된 비-GET 요청
```
가로채지 않은 요청은 명시적 404로 떨궈 **실 네트워크로 새지 않는다.**

### 5.4 새 `(main)` 스모크 추가 (FRT-30 패턴)
진입 화면이 렌더되는지만 확인하는 가장 가벼운 테스트:
```ts
import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

test("내 새 화면이 data 시나리오에서 렌더된다", async ({ page }) => {
  await stubApi(page, { authed: true, scenario: "data" }); // ← page.goto 전에 호출
  await page.goto("/my-route");

  await expect(page.getByRole("heading", { level: 1, name: "내 화면 제목" })).toBeVisible();
  await expect(page).toHaveURL(/\/my-route$/);
  await expect(page.getByRole("link", { name: "ARC" })).toBeVisible(); // GNB 로고
});
```
여러 라우트를 한꺼번에 돌리려면 `main-routes.smoke.spec.ts`의 `ROUTES` 배열에 케이스를
추가한다(각 라우트 × `{data, empty}` 시나리오로 전개됨). 공개(비인증) 화면이면
`smoke.spec.ts`처럼 `stubApi` 없이 `page.goto` + 텍스트 단언만 한다.

### 5.5 동작(behavior) E2E 추가 (FRT-43 패턴)
변이가 반영되는지까지 보려면 `handle.mutations`로 요청을 단언한다:
```ts
const stub = await stubApi(page, { authed: true, scenario: "data" });
await page.goto("/analysis/comprehensive");

await page.getByRole("button", { name: "즐겨찾기", exact: true }).click();
await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toBeVisible();
expect(
  stub.mutations.filter((m) => m.method === "POST" && m.path === "/analysis/bookmarks/comp-1"),
).toHaveLength(1);
```
`stateful-store.ts`가 변이를 반영하므로 페이지를 옮겨도(`/analysis/bookmarks`) 상태가
유지된다 — 다중 페이지 반영까지 한 스펙에서 검증할 수 있다.

---

## 6. Vitest — 유닛 작성

### 6.1 설정 (`vitest.config.ts` / `vitest.setup.ts`)
- 환경 `jsdom`, **`globals: false`** → `describe`/`it`/`expect`/`vi`를 **파일마다 import**한다.
- include `**/*.test.{ts,tsx}`, exclude `e2e/**` → Playwright `*.spec.ts`와 분리(겹치지 않음).
- alias `@` → 프로젝트 루트. setup에서 `@testing-library/jest-dom/vitest` 매처 등록.

### 6.2 매퍼·방어 파싱 패턴
백엔드 응답을 FE 타입으로 바꾸는 매퍼/파싱은 **경계값과 깨진 입력**을 테스트한다:
```ts
import { describe, expect, it } from "vitest";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";

describe("toExperienceV2", () => {
  it("content가 null/undefined여도 throw 없이 기본값을 반환한다", () => {
    const v2 = toExperienceV2(makeExperience({ content: undefined as never }));
    expect(v2.title).toBe("");
    expect(v2.coreBlocks).toEqual([]);
  });

  it("importance 경계: 정수 1~5만 통과, 그 외 undefined", () => {
    expect(toExperienceV2(makeExperience({ importance: 0 })).importance).toBeUndefined();
    expect(toExperienceV2(makeExperience({ importance: 6 })).importance).toBeUndefined();
  });
});
```
위 `makeExperience`는 테스트 파일 로컬 픽스처 헬퍼다 — 실제 구현은
`lib/utils/experience-mapper.test.ts`를 그대로 참고한다. 다른 예시: `lib/api/client.test.ts`
(503/네트워크 방어), `lib/api/analysis-api.test.ts`. **버그를 고칠 땐 그 버그를 재현하는
실패 테스트를 먼저** 쓴다.

---

## 7. CI 동작 (언제 무엇이 도는가)

| 워크플로 | 트리거 | 검증 내용 | 머지 게이트 |
|---|---|---|---|
| `ci.yml` | PR → `main`·`dev` | Lint · Typecheck · **Unit(Vitest)** · Build | ✅ |
| `e2e.yml` | PR → `main`·`dev` | Playwright `(main)` 스모크·동작 (chromium) | ✅ |
| `storybook-test.yml` | PR → `main`·`dev` | 모든 스토리 마운트 + `play` (console.error / pageerror 0건) | ✅ |
| `chromatic.yml` | **수동** (`workflow_dispatch`) | 시각 회귀 스냅샷 | ❌ (비차단·정보용) |

관심사별로 워크플로를 **분리**한다 — 느린 E2E/Storybook이 빠른 정적 검사(lint/type/build)
피드백을 막지 않도록. 세 PR 워크플로를 실제 머지 차단으로 쓰려면 **dev 브랜치 보호의
required checks**에 `ci` / `e2e` / `storybook-test`를 등록해야 한다(워크플로 존재 ≠ required).

---

## 8. 참고

- 테스트 기반 구축 이력: Linear **Frontend Test Foundation** 프로젝트 (이 문서 = FRT-32).
- 실 백엔드 통합 E2E(2차, FRT-33)는 **deferred** — BE 계약 안정화 후 재검토.
- 워크플로 정본: 루트 `CLAUDE.md` → *Development Workflow (Mandatory)*.

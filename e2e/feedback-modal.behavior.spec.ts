import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { Experience } from "@/types/experience";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";

import { experienceList, success } from "./fixtures/api-data";
import { DEFAULT_PAGE_ORIGIN, STUB_API_URL, corsHeaders, stubApi } from "./fixtures/stub-api";

/**
 * FRT-96 — 인앱 피드백 모달의 노출·중복방지 동작(behavior) E2E.
 *
 * 판정 로직 자체는 유닛이 두텁게 덮는다(FeedbackHost.test.tsx 21건 · useFeedbackPrompt.test.ts).
 * 여기서 보는 것은 유닛이 흉내만 낼 수 있는 층이다 — **실제 라우트 위에서 `(main)` 레이아웃에
 * 마운트된 Host 가, 실제 HTTP 응답을 받아, 실제로 모달을 띄우는가**. 배선이 끊겨도 유닛은
 * 전부 통과하므로 이 스펙이 없으면 회귀를 아무도 못 본다.
 *
 * 노출 게이트는 2겹이다:
 *   1) `NEXT_PUBLIC_FEEDBACK_ENABLED` — playwright.config 가 dev 서버에 **전역** 주입(끌 수 없음).
 *   2) `stubApi(page, { feedback: true })` — 서버가 prompt-shown 에 200 을 주느냐(스펙별 opt-in).
 * 이 스펙만 2겹을 다 열고, 나머지 스펙은 2번이 닫혀 404 → 훅 fail-closed 로 모달이 뜨지 않는다.
 *
 * ⚠️ 시나리오 "분석 완료"는 시드 픽스처 `comp-1` 이 `status: "completed"` 인 데 의존한다
 *    (api-data.ts `snapshot()` 기본값). 이게 `processing` 으로 바뀌면 폴링이 3초 × 20회를
 *    돌아 타임아웃난다.
 */

const EXPERIENCE_QUESTION = "ARC에 기록해 보니 어떠셨나요?";
const ANALYSIS_QUESTION = "방금 이 분석, 도움이 됐나요?";
const CAMPAIGN_PATH = "/feedback/campaigns/analysis-satisfaction";

/** 지연이 지나고도 뜨지 않음을 확인할 때 기다리는 시간. 상수를 복제하면 값이 바뀔 때 조용히 낡는다. */
const PAST_DELAY_MS = FEEDBACK_PROMPT_DELAY_MS + 800;

/**
 * 시드의 첫 경험(`status: "complete"`)을 원본으로 삼는다. 두 번째 시드는 `status: "draft"` 라
 * `getSelectableExperiences` 의 isComplete 가 false → 분석 생성 화면에서 걸러져 선택할 수 없다.
 * 복제 원본을 첫 경험으로 고정해야 "선택 가능한 경험 N개"가 실제로 N개가 된다.
 */
const COMPLETE_SEED = experienceList("data").data.contents[0];

function makeCompleteExperiences(count: number): Experience[] {
  return Array.from({ length: count }, (_, i) => ({
    ...COMPLETE_SEED,
    id: `exp-e2e-feedback-${i + 1}`,
    content: { ...COMPLETE_SEED.content, title: `피드백 e2e 경험 ${i + 1}` },
  }));
}

/**
 * 경험 목록 GET 을 지정 개수로 덮는다. 공용 시드(api-data.ts)를 늘리면 개수를 단언하는 다른
 * 스펙들이 함께 흔들리므로, 이 스펙 안에서만 덮는다.
 *
 * ⚠️ `stubApi` **이후**에 등록해야 우선한다(Playwright route 는 나중 등록이 먼저 매칭된다).
 * ⚠️ glob `*` 는 `/` 를 넘지 못한다(FRT-95 에서 `${ORIGIN}/experiences*` 가 통째로 빗나갔다).
 *    URL 매처 함수 + pathname **정확 비교**로 `/libraries/{id}/experiences` 와 섞이지 않게 앵커링한다.
 * ⚠️ 개수의 정본은 `data.count` 다 — useExperiences 가 contents.length 가 아니라 count 를 읽는다.
 */
async function stubExperienceCount(page: Page, count: number): Promise<void> {
  const contents = makeCompleteExperiences(count);
  await page.route(
    (url) => url.href.startsWith(STUB_API_URL) && url.pathname === "/experiences/",
    async (route) => {
      // 목록 GET 만 덮고 생성(POST)은 원래 stateful 라우터로 돌려보낸다.
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      // CORS 헤더는 픽스처(corsHeaders)를 재사용한다 — 리터럴로 복제하면 계약이 바뀔 때
      // 이 스펙만 조용히 낡아 브라우저가 응답을 못 읽는 형태로 깨진다(.claude/rules/testing.md).
      const origin = route.request().headers()["origin"] ?? DEFAULT_PAGE_ORIGIN;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders(origin),
        body: JSON.stringify(success({ count: contents.length, contents })),
      });
    },
  );
}

/**
 * 판정 POST 가 나갔는지 먼저 확인한다. 모달을 곧장 기다리면 "안 뜬다"는 사실만 남고 원인은
 * 안 보이는데, 이 단계가 실패하면 원인이 좁혀진다 — 훅은 플래그가 꺼져 있으면 POST 자체를
 * 보내지 않기 때문이다(useFeedbackPrompt 의 isFeedbackEnabled 게이트).
 *
 * ⚠️ 가장 흔한 원인: **개발자가 띄워 둔 dev 서버를 재사용**한 경우. `reuseExistingServer` 가
 * true 라 playwright.config 의 webServer 가 아예 기동되지 않고, 그러면 그 env 들
 * (NEXT_PUBLIC_FEEDBACK_ENABLED 등)이 앱에 주입되지 않는다. 3000 포트의 기존 서버를 끄고
 * 다시 돌리면 해결된다. consent·password-reset 스펙도 같은 조건을 공유한다.
 */
async function expectPromptDecided(stub: { mutations: { method: string; path: string }[] }) {
  await expect
    .poll(() => promptShownCalls(stub.mutations).length, {
      message:
        "prompt-shown POST 가 나가지 않았다 — NEXT_PUBLIC_FEEDBACK_ENABLED 가 주입되지 않은 " +
        "dev 서버를 재사용했을 가능성이 높다(3000 포트의 기존 서버를 끄고 다시 실행할 것).",
    })
    .toBeGreaterThan(0);
}

/** 경험 트리거(3개 도달)로 모달이 뜬 상태까지 만든다. */
async function openViaExperienceThreshold(page: Page) {
  const stub = await stubApi(page, { authed: true, scenario: "data", feedback: true });
  await stubExperienceCount(page, 3);
  await page.goto("/dashboard");

  await expectPromptDecided(stub);
  const modal = page.getByRole("dialog", { name: EXPERIENCE_QUESTION });
  await expect(modal).toBeVisible();
  return { stub, modal };
}

function promptShownCalls(mutations: { method: string; path: string }[]) {
  return mutations.filter(
    (m) => m.method === "POST" && m.path === `${CAMPAIGN_PATH}/prompt-shown`,
  );
}

test.describe("FRT-96 피드백 모달 노출", () => {
  test("경험 3개에 도달하면 대시보드 진입 후 모달이 뜬다", async ({ page }) => {
    const { stub, modal } = await openViaExperienceThreshold(page);

    // 경험 게이트로 떴으므로 질문 문구는 경험용이다(Dialog 의 aria-label = 질문).
    await expect(modal.getByRole("radio", { name: "별 1점" })).toBeVisible();
    // 노출 기록 POST 는 정확히 1건 — 마운트당 1회 판정(useFeedbackPrompt 의 decidedRef).
    expect(promptShownCalls(stub.mutations)).toHaveLength(1);
    expect(promptShownCalls(stub.mutations)[0]).toMatchObject({
      body: { trigger_source: "experience_threshold" },
    });
  });

  test("분석이 완료되면 이동한 결과 화면 위에서 모달이 뜬다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true, scenario: "data", feedback: true });
    // 경험은 2개 = 임계(3) 미만. 경험 게이트를 닫아 두어야 이 테스트가 **분석 게이트만** 본다.
    await stubExperienceCount(page, 2);
    await page.goto("/analysis/comprehensive/new");

    // 경험 2개 선택 → 분석 시작. checkbox 는 sr-only 라 감싼 label 을 클릭한다.
    await page.getByText("피드백 e2e 경험 1").click();
    await page.getByText("피드백 e2e 경험 2").click();
    await page.getByRole("button", { name: "분석 시작" }).click();

    // 폴링이 comp-1(completed)을 즉시 찾아 결과 상세로 이동한다.
    await expect(page).toHaveURL(/\/analysis\/comprehensive\/comp-1$/);
    await expectPromptDecided(stub);

    // 생성 화면(`/analysis/*/new`)은 억제 경로다 — 신호는 거기서 **보류**됐다가 상세로
    // 이동한 뒤에야 지연을 세고 뜬다. 유닛이 pathname 을 흉내내던 부분이 여기서 실제로 확인된다.
    await expect(page.getByRole("dialog", { name: ANALYSIS_QUESTION })).toBeVisible();
    expect(promptShownCalls(stub.mutations)).toHaveLength(1);
    expect(promptShownCalls(stub.mutations)[0]).toMatchObject({
      body: { trigger_source: "analysis_completed" },
    });
  });

  test("트리거가 충족되지 않으면 모달도, 노출 기록 요청도 없다", async ({ page }) => {
    // 경험 2개(임계 3 미만)이고 분석을 완료한 적도 없다 → 게이트가 하나도 안 열린다.
    // 개수는 **명시적으로** 고정한다 — 공용 시드가 2개라는 우연에 기대면, 누가 시드를 늘렸을 때
    // 이 테스트가 "트리거 미충족"이라는 전제를 잃은 채 실패해 원인이 드러나지 않는다.
    const stub = await stubApi(page, { authed: true, scenario: "data", feedback: true });
    await stubExperienceCount(page, 2);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.waitForTimeout(PAST_DELAY_MS);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    // 모달이 안 뜨는 것만으로는 부족하다 — 판정 자체가 일어나지 않아야 한다(불필요한 POST 금지).
    expect(promptShownCalls(stub.mutations)).toHaveLength(0);
  });
});

test.describe("FRT-96 피드백 모달 중복방지", () => {
  test("별점과 의견을 제출하면 저장 요청이 나가고 모달이 닫힌다", async ({ page }) => {
    const { stub, modal } = await openViaExperienceThreshold(page);

    await modal.getByRole("radio", { name: "별 4점" }).click();
    // 자유텍스트는 별점을 고른 뒤에야 열린다(적응형).
    const comment = modal.getByLabel("한마디 의견 (선택)");
    await expect(comment).toBeEnabled();
    await comment.fill("기록이 쉬워서 좋았어요");
    await modal.getByRole("button", { name: "보내기" }).click();

    await expect(modal).toBeHidden();

    const responses = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === `${CAMPAIGN_PATH}/responses`,
    );
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      // 경험 게이트로 떴으므로 분석 컨텍스트가 없어야 맞다(feedback-api 가 null 로 명시 전송).
      body: { rating: 4, comment: "기록이 쉬워서 좋았어요", context: null },
    });
  });

  test("제출한 뒤에는 화면을 옮겨도 새로고침해도 다시 뜨지 않는다", async ({ page }) => {
    const { stub, modal } = await openViaExperienceThreshold(page);

    await modal.getByRole("radio", { name: "별 5점" }).click();
    await modal.getByRole("button", { name: "보내기" }).click();
    await expect(modal).toBeHidden();

    // (1) 같은 세션 안에서 화면 이동 — GNB 링크 클릭이라 client-side 전환이고, Host 는 마운트된
    //     채 살아남는다. 여기서 막는 것은 훅의 로컬 상태(closed)다.
    //     ⚠️ `page.goto` 를 쓰면 full page load 라 Host 가 재마운트돼 이 층을 검증할 수 없다.
    await page.getByRole("link", { name: "아카이브" }).first().click();
    await expect(page).toHaveURL(/\/archive$/);
    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Host 가 살아 있다는 증거 — 재마운트됐다면 판정 POST 가 한 번 더 나갔을 것이다.
    expect(promptShownCalls(stub.mutations)).toHaveLength(1);

    // (2) 새로고침 — Host 가 재마운트되므로 로컬 상태는 전부 사라진다. 여기서 다시 안 뜨는 것은
    //     오직 **서버의 노출 기록**(created:false)이 보장한다. 계약 §3 의 핵심이자,
    //     유닛이 구조적으로 볼 수 없는 지점이다.
    await page.reload();
    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 재마운트로 판정 POST 가 한 번 더 나갔지만(정상), 서버가 created:false 로 막았다.
    expect(promptShownCalls(stub.mutations)).toHaveLength(2);
  });

  test("X 버튼으로 닫으면 그 방문에서도 새로고침 후에도 다시 뜨지 않는다", async ({ page }) => {
    const { stub, modal } = await openViaExperienceThreshold(page);

    await modal.getByRole("button", { name: "닫기" }).click();
    await expect(modal).toBeHidden();

    // 그냥 닫은 사용자에게도 재노출은 없다 — dedup 기준이 "응답"이 아니라 "노출"이기 때문이다.
    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 닫기만 했으므로 응답 저장은 일어나지 않아야 한다.
    expect(
      stub.mutations.filter((m) => m.path === `${CAMPAIGN_PATH}/responses`),
    ).toHaveLength(0);
  });

  test("Escape 로 닫아도 다시 뜨지 않는다", async ({ page }) => {
    const { modal } = await openViaExperienceThreshold(page);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("모달 바깥을 클릭해 닫아도 다시 뜨지 않는다", async ({ page }) => {
    const { modal } = await openViaExperienceThreshold(page);

    const urlBeforeClick = page.url();

    // 모달은 화면 중앙에 뜨므로 좌상단 모서리는 backdrop 이다.
    await page.mouse.click(10, 10);
    await expect(modal).toBeHidden();
    // 사라진 **이유**까지 고정한다. 오버레이가 `fixed inset-0`(components/ui/dialog.tsx)을 잃으면
    // 이 클릭은 GNB 링크를 눌러 화면을 옮기고, 그때도 모달은 사라져 위 단언만으로는 통과한다.
    expect(page.url()).toBe(urlBeforeClick);

    await page.waitForTimeout(PAST_DELAY_MS);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

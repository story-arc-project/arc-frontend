import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * FRT-86 — 미리보기를 연 채 이웃 기록으로 넘어가기(마스터-디테일 peer 네비) 회귀 가드.
 *
 * 미리보기가 열려 있는 동안 ↑/↓·K/J 와 헤더의 ⌃/⌄ 버튼으로 목록의 이전/다음 기록으로
 * 바로 이동한다. 목록으로 돌아갔다 다시 클릭하는 왕복이 사라지는 것이 이 기능의 값이다.
 *
 * stateful stub(FRT-42) 위에서 백엔드 없이 결정론적으로 검증한다. "data" 시나리오의 경험은
 * 2건이고 기본 정렬(updated 내림차순)이라 목록 순서는 항상 아래와 같다:
 *   1) exp-e2e-2 "캡스톤 팀 프로젝트" (2026-02-20)
 *   2) exp-e2e-1 "교내 개발 동아리 운영진" (2026-01-15)
 * 즉 첫 항목은 위로, 마지막 항목은 아래로 갈 곳이 없어 두 경계를 모두 덮는다.
 */

const FIRST = "캡스톤 팀 프로젝트";
const SECOND = "교내 개발 동아리 운영진";

/** 우측 미리보기에 도킹된 상세의 제목(h2)으로 지금 무엇을 보고 있는지 판정한다. */
function detailHeading(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("heading", { level: 2, name });
}

/** 첫 카드를 클릭해 미리보기를 연다(목록 h3 → 상세 h2). */
async function openFirstPreview(page: import("@playwright/test").Page) {
  await page.getByRole("heading", { level: 3, name: FIRST }).click();
  await expect(detailHeading(page, FIRST)).toBeVisible();
  await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);
}

test.describe("FRT-86 미리보기 peer 네비게이션", () => {
  test("↓/J 로 다음, ↑/K 로 이전 기록으로 미리보기가 교체된다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    // ↓ — 목록으로 돌아가지 않고 미리보기 내용만 다음 기록으로 바뀐다.
    await page.keyboard.press("ArrowDown");
    await expect(detailHeading(page, SECOND)).toBeVisible();
    await expect(detailHeading(page, FIRST)).toHaveCount(0);
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);

    // K — 화살표와 같은 방향 규약(위=이전).
    await page.keyboard.press("k");
    await expect(detailHeading(page, FIRST)).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);

    // J — 화살표와 같은 방향 규약(아래=다음).
    await page.keyboard.press("j");
    await expect(detailHeading(page, SECOND)).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);
  });

  test("목록 경계에서 멈추고, 그 방향 버튼이 잠긴다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    // 첫 항목 — 위로는 갈 곳이 없다. 순환하지 않으므로 마지막 항목으로 넘어가면 안 된다.
    const prev = page.getByRole("button", { name: "이전 기록" });
    const next = page.getByRole("button", { name: "다음 기록" });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    await page.keyboard.press("ArrowUp");
    await expect(detailHeading(page, FIRST)).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);

    // 마지막 항목 — 아래로는 갈 곳이 없다. 잠기는 쪽이 반대로 뒤집힌다.
    await page.keyboard.press("ArrowDown");
    await expect(detailHeading(page, SECOND)).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();

    await page.keyboard.press("ArrowDown");
    await expect(detailHeading(page, SECOND)).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);
  });

  test("키보드로 넘기면 포커스도 그 카드로 따라온다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    const focusedCardId = () =>
      page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.dataset.experienceId ?? null,
      );

    // 클릭 직후엔 클릭한 카드가 포커스를 가진다(브라우저 기본 동작).
    expect(await focusedCardId()).toBe("exp-e2e-2");

    // 키로 넘기면 포커스가 새 카드로 옮겨가야 한다. 안 옮기면 처음 클릭한 카드에
    // :focus-visible 링이 남아 선택 강조(주황 테두리+accent bar)와 서로 다른 카드를 가리킨다.
    await page.keyboard.press("ArrowDown");
    await expect(detailHeading(page, SECOND)).toBeVisible();
    expect(await focusedCardId()).toBe("exp-e2e-1");
  });

  test("⌃/⌄ 버튼이 키보드와 같은 방향으로 움직인다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    await page.getByRole("button", { name: "다음 기록" }).click();
    await expect(detailHeading(page, SECOND)).toBeVisible();

    await page.getByRole("button", { name: "이전 기록" }).click();
    await expect(detailHeading(page, FIRST)).toBeVisible();
  });

  test("검색 입력 중의 J/K 는 글자로 들어가고 미리보기를 넘기지 않는다", async ({
    page,
  }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    // 거울상 검증: "미리보기가 안 넘어간다"가 가드 덕분인지, 아니면 애초에 키 이벤트가
    // 닿지 않아서인지를 가른다 — 같은 입력이 검색어로는 정확히 들어가야 한다.
    // 검색 바는 데스크톱·모바일 레이아웃 양쪽에 렌더되므로(CSS 로만 한쪽을 숨긴다)
    // 기존 아카이브 스펙과 같이 first() 로 데스크톱 것을 집는다.
    const search = page.getByPlaceholder("경험 검색...").first();
    await search.click();
    await page.keyboard.press("j");
    await page.keyboard.press("k");

    await expect(search).toHaveValue("jk");
    await expect(detailHeading(page, FIRST)).toBeVisible();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);
  });

  test("연속으로 넘겨도 히스토리가 쌓이지 않는다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    const historyLength = () => page.evaluate(() => history.length);
    const beforeOpen = await historyLength();

    // 카드 클릭(목록→상세)은 되돌아갈 지점이므로 히스토리가 하나 늘어난다.
    await openFirstPreview(page);
    const afterOpen = await historyLength();
    expect(afterOpen).toBe(beforeOpen + 1);

    // peer 이동은 같은 화면 안에서의 이동이라 replace 다 — 몇 번을 넘겨도 그대로여야 한다.
    // push 로 되돌아가면 넘긴 횟수만큼 뒤로가기를 눌러야 목록에 닿는다.
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);
    await page.keyboard.press("ArrowUp");
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-1/);

    // 그래서 뒤로가기 한 번이면 목록으로 돌아온다 — 넘긴 횟수와 무관하게 한 번이다.
    await page.goBack();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(detailHeading(page, FIRST)).toHaveCount(0);
    await expect(detailHeading(page, SECOND)).toHaveCount(0);
  });

  test("넘긴 직후 곧바로 뒤로가기 해도 미리보기가 닫힌다", async ({ page }) => {
    // FRT-268 회귀 가드. peer 이동은 replace 라, 그 반영이 searchParams 에 닿기 전에 Back 이
    // 끼어들면 반영이 통째로 버려진다. 그러면 "URL 의 ?id 가 사라졌으면 닫는다" 판정을
    // 상태로만 추론하는 구현에서는 기준선(syncedForParams)만 옛 id 에 멈춰 판정이 영구히
    // 거짓이 되고, 주소는 목록인데 미리보기만 열린 채 남는다.
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    // 이동과 Back 을 한 태스크 안에서 연달아 일으켜 그 과도기를 확정적으로 만든다.
    // (사람 손으로는 수십 ms 안에 벌어지는 일이라 두 번의 원격 호출로는 재현이 들쭉날쭉하다.
    //  keydown 리스너는 window 에 달려 있어 합성 이벤트도 같은 경로를 탄다.)
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      history.back();
    });

    await expect(page).toHaveURL(/\/archive$/);
    await expect(detailHeading(page, FIRST)).toHaveCount(0);
    await expect(detailHeading(page, SECOND)).toHaveCount(0);

    // 닫기는 되돌릴 수 있어야 한다 — 앞으로가기로 ?id 가 돌아오면 그 기록이 다시 도킹된다.
    // (동기화 기준선을 함께 비우지 않으면 `idParam === syncedForParams` 라 재선택을 건너뛰어
    //  주소만 ?id 이고 미리보기는 닫힌 채 남는다.)
    await page.goForward();
    await expect(page).toHaveURL(/\/archive\?id=exp-e2e-2/);
    await expect(detailHeading(page, FIRST)).toBeVisible();
  });

  test("md 아래(모바일)에서는 포커스가 풀스크린 미리보기로 옮겨온다", async ({ page }) => {
    // 목록 카드는 데스크톱 레이아웃(hidden md:flex) 안에 있어 이 폭에서는 display:none 이다.
    // 그대로 card.focus() 를 부르면 조용히 무시돼 포커스가 body 에 남고, 스크린리더가
    // 넘어간 기록을 따라오지 못한다. 화면을 채우고 있는 미리보기가 대신 포커스를 받아야 한다.
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");

    await page.getByRole("heading", { level: 3, name: FIRST }).click();
    await expect(detailHeading(page, FIRST)).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(detailHeading(page, SECOND)).toBeVisible();

    const focusedPanel = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.previewPanel ?? null,
    );
    expect(focusedPanel).toBe("mobile");
  });

  test("ESC 로 미리보기를 닫는 기존 동작이 유지된다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await openFirstPreview(page);

    await page.keyboard.press("Escape");
    await expect(detailHeading(page, FIRST)).toHaveCount(0);
    await expect(page).toHaveURL(/\/archive$/);
  });
});

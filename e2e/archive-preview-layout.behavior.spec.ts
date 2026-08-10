import { expect, test } from "@playwright/test";

import { stubApi } from "./fixtures/stub-api";

/**
 * 미리보기 패널이 **가장 좁아지는 지점**의 레이아웃 회귀 가드.
 *
 * 목록은 `w-[360px] shrink-0` 로 고정이라 패널 폭은 "뷰포트 − 360" 이다. 즉 side-by-side 가
 * 켜지는 md 경계(768px) 바로 위에서 패널이 최소(≈416px)가 되고, 뷰포트가 커질수록 넓어진다.
 * 넓은 화면만 보고 잡은 여백은 이 지점에서만 무너지므로 경계 바로 위를 따로 고정한다.
 *
 * 실제로 `md:px-12`(48px)가 여기까지 내려와 콘텐츠를 320px 로 눌렀고, 제목이 두 줄로 쪼개져
 * 구분선·본문과 폭이 어긋나 보였다. 여백을 `lg:` 로 미뤄 콘텐츠를 376px 로 되돌린 것이 처방이다.
 */

const BOUNDARY_WIDTH = 776;
const LIST_WIDTH = 360; // page.tsx 의 w-[360px] shrink-0
const TITLE = "캡스톤 팀 프로젝트";

test.describe("미리보기 패널 경계 폭(776px) 레이아웃", () => {
  test.use({ viewport: { width: BOUNDARY_WIDTH, height: 900 } });

  test("좁은 패널에서 좌우 여백이 콘텐츠를 밀어내지 않는다", async ({ page }) => {
    await stubApi(page, { authed: true, scenario: "data" });
    await page.goto("/archive");
    await page.getByRole("heading", { level: 3, name: TITLE }).click();
    await expect(page.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const h2 = document.querySelector("h2");
      if (!h2) throw new Error("detail heading not found");
      const detailRoot = h2.closest('[class*="max-w-"]') as HTMLElement;
      const style = getComputedStyle(detailRoot);

      return {
        panelWidth: detailRoot.getBoundingClientRect().width,
        paddingLeft: parseFloat(style.paddingLeft),
        paddingRight: parseFloat(style.paddingRight),
        // 실제 글이 놓이는 폭 = 패널 − 좌우 여백
        contentWidth:
          detailRoot.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
      };
    });

    // 전제 확인 — 이 뷰포트에서 패널은 실제로 최소 폭이다(목록이 고정 폭이므로).
    expect(Math.round(metrics.panelWidth)).toBe(BOUNDARY_WIDTH - LIST_WIDTH);

    // 여백은 좌우 대칭이어야 한다(한쪽으로 쏠리지 않는다).
    expect(metrics.paddingLeft).toBe(metrics.paddingRight);

    // 핵심: 넓은 화면용 여백(48px)이 내려오면 콘텐츠가 320px 로 눌린다. 패널의 9할은 글에 준다.
    // 폰트 메트릭에 의존하는 "제목 줄 수" 대신 폭을 재는 이유는 CI/로컬 한글 폰트가 달라도
    // 같은 판정을 내리기 위해서다.
    expect(metrics.contentWidth).toBeGreaterThan(metrics.panelWidth * 0.9);
  });
});

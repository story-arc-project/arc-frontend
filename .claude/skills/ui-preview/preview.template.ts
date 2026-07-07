import { test, type Page } from "@playwright/test";

import { stubApi, type StubApiOptions } from "../fixtures/stub-api";

/**
 * ui-preview 스킬 전용 임시 스펙 — e2e/preview/preview.spec.ts 로 복사해 사용한다.
 * e2e/preview/ 는 gitignore 대상이며 CI·기본 e2e 러너에서 제외된다. 커밋 금지.
 *
 * ROUTES 만 이번 변경에 맞게 수정한다:
 * - stub: 시나리오/인증 오버라이드 (기본 authed+data)
 * - prepare: 캡처 전 상호작용 (모달 열기, 탭 전환 등)
 */
const ROUTES: {
  path: string;
  name: string;
  stub?: StubApiOptions;
  prepare?: (page: Page) => Promise<void>;
}[] = [
  { path: "/dashboard", name: "dashboard" },
  // { path: "/archive", name: "archive-empty", stub: { authed: true, scenario: "empty" } },
];

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
] as const;

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    test(`${route.name} @${vp.label}`, async ({ page }) => {
      await stubApi(page, { authed: true, ...route.stub });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      if (route.prepare) await route.prepare(page);
      await page.screenshot({
        path: `e2e/preview/out/${route.name}--${vp.label}.jpg`,
        type: "jpeg",
        quality: 70,
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}

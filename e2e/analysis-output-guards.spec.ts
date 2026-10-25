import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { stubApi } from "./fixtures/stub-api";
import { API_ORIGIN } from "./fixtures/api-origin";
import { comprehensiveDetail, individualDetail, keywordDetail, resumeDetail, success } from "./fixtures/api-data";

// FRT-137: raw malformed responses pass through the real API mapper and actual detail routes.
// These fixtures prove browser behavior, not live backend output or deployment.
for (const width of [1440, 390]) {
  test.describe(`${width}px AI 출력 경계`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.beforeEach(async () => {
      if (process.env.FRT137_CAPTURE_DIR) await mkdir(process.env.FRT137_CAPTURE_DIR, { recursive: true });
    });

    test("불확실한 커버리지 비율을 숨기고 유효한 API 비율은 유지한다", async ({ page }) => {
      await stubApi(page, { authed: true });
      const data = keywordDetail().data;
      data.coverage = [
        { keyword: "분모 누락", related_count: 2, coverage_percent: 100, high_count: 2 },
        { keyword: "분모 초과", related_count: 3, total_count: 2, coverage_percent: 150 },
        { keyword: "분모 영", related_count: 0, total_count: 0, coverage_percent: 0 },
        { keyword: "정상 비율", related_count: 1, total_count: 4, coverage_percent: 25 },
      ];
      await page.route(`${API_ORIGIN}/analysis/keyword/kw-1`, (route) => route.fulfill({ json: success(data) }));
      await page.goto("/analysis/keyword/kw-1");
      await expect(page.getByRole("heading", { name: "커버리지", exact: true })).toBeVisible();
      await expect(page.getByRole("progressbar")).toHaveCount(1);
      await expect(page.getByRole("progressbar", { name: "정상 비율 커버리지" })).toHaveAttribute("aria-valuenow", "25");
      await expect(page.getByText("1/4 · 25%", { exact: true })).toBeVisible();
      await expect(page.getByText("높음 2", { exact: true })).toBeVisible();
      for (const label of ["분모 누락", "분모 초과", "분모 영"]) {
        const card = page.getByText(label, { exact: true }).locator("../..");
        await expect(card).not.toContainText("%");
        await expect(card.getByRole("progressbar")).toHaveCount(0);
      }
      if (process.env.FRT137_CAPTURE_DIR) {
        await page.getByRole("heading", { name: "커버리지", exact: true }).evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.screenshot({ path: `${process.env.FRT137_CAPTURE_DIR}/keyword-${width}.jpg`, fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
      }
    });

    test("명시 false와 모순되는 강점은 숨기고 사유를 보여준다", async ({ page }) => {
      await stubApi(page, { authed: true });
      const data = individualDetail().data;
      const body = data.result as Record<string, unknown>;
      body.item_strengths = {
        has_genuine_strengths: false,
        one_line_strength_verdict: "노출 금지 강점 요약",
        summarized_strengths: ["노출 금지 한눈에"],
        strengths: [{ title: "노출 금지 카드", analysis: "노출 금지 분석" }],
        strongest_asset: "노출 금지 자산",
        positioning_tip: "노출 금지 조언",
        no_strength_reason: "아직 역할과 성과의 근거가 부족합니다.",
      };
      await page.route(`${API_ORIGIN}/analysis/individual/ind-1`, (route) => route.fulfill({ json: success(data) }));
      await page.goto("/analysis/individual/ind-1");
      await expect(page.getByText("아직 역할과 성과의 근거가 부족합니다.", { exact: true })).toBeVisible();
      await expect(page.getByText(/노출 금지/)).toHaveCount(0);
      if (process.env.FRT137_CAPTURE_DIR) await page.getByText("아직 역할과 성과의 근거가 부족합니다.", { exact: true }).evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      if (process.env.FRT137_CAPTURE_DIR) await page.screenshot({ path: `${process.env.FRT137_CAPTURE_DIR}/individual-${width}.jpg`, fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
    });

    test("학교 누락과 역순 키에서도 학력줄 없이 강점을 먼저 보여준다", async ({ page }) => {
      await stubApi(page, { authed: true });
      const { user_school: school, user_department: department, strength_diagnosis: strength, critical_diagnosis: critical, ...rest } = comprehensiveDetail().data;
      void school; void department;
      const data = { ...rest, critical_diagnosis: critical, strength_diagnosis: strength };
      await page.route(`${API_ORIGIN}/analysis/comprehensive/comp-1`, (route) => route.fulfill({ json: success(data) }));
      await page.goto("/analysis/comprehensive/comp-1");
      await expect(page.getByRole("heading", { name: "종합 분석 결과" })).toBeVisible();
      await expect(page.locator("main header p")).toHaveCount(0);
      const headings = page.getByRole("heading");
      await expect(page.getByRole("heading", { name: "강점 진단", exact: true })).toBeVisible();
      const names = await headings.allTextContents();
      expect(names.indexOf("강점 진단")).toBeLessThan(names.indexOf("보완 포인트"));
      if (process.env.FRT137_CAPTURE_DIR) await page.getByRole("heading", { name: "강점 진단", exact: true }).evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      if (process.env.FRT137_CAPTURE_DIR) await page.screenshot({ path: `${process.env.FRT137_CAPTURE_DIR}/comprehensive-${width}.jpg`, fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
    });

    test("예상 밖 레쥬메 meta.format에서도 상세 편집과 미리보기가 열린다", async ({ page }) => {
      await stubApi(page, { authed: true });
      const data = structuredClone(resumeDetail().data);
      data.meta.format = { unexpected: true } as never;
      await page.route(`${API_ORIGIN}/export/resume/resume-e2e-1`, (route) => route.fulfill({ json: success(data) }));
      await page.goto("/export/resume/resume-e2e-1");
      await expect(page.getByLabel("이름", { exact: true })).toHaveValue("김아크");
      if (width < 768) await page.getByRole("button", { name: "미리보기", exact: true }).click();
      await expect(page.getByRole("article")).toContainText("김아크");
      if (process.env.FRT137_CAPTURE_DIR) await page.screenshot({ path: `${process.env.FRT137_CAPTURE_DIR}/resume-${width}.jpg`, fullPage: true, animations: "disabled", type: "jpeg", quality: 70 });
    });
  });
}

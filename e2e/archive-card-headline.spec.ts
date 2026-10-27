import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { stubApi, corsHeaders, STUB_API_URL } from "./fixtures/stub-api";
import { getTemplateForType, EXPERIENCE_TYPE_MAP } from "../lib/constants/templates-v2";
import { experienceList, success } from "./fixtures/api-data";

const longHeadline = "Achievement".repeat(30);
const certificate = getTemplateForType("language").extensions.flatMap(section => section.blocks).find(block => block.key === "lang-certificate.어학 자격증")!;
const cases = [
  { id: "language", type: "language", title: "TOEIC", summary: "어학 요약", headline: "970점", fields: { "lang-certificate.어학 자격증": { ...certificate.value, rows: [{ id: "exam", cells: { name: "TOEIC", score: "970점" } }] } } },
  { id: "award", type: "award", title: "전국 공모전", summary: "수상 요약", headline: "대상", fields: { "award-info.수상 훈격": { type: "text", text: "대상" } } },
  { id: "metric", title: "서비스 전환 개선", summary: "중복하지 않을 요약", headline: "전환율 20% 개선", fields: { "career-detail.나의 담당 업무 / 주요 성과": { type: "textarea", text: "전환율 20% 개선" } } },
  { id: "summary", title: "검색 품질 프로젝트", summary: "검색 품질 개선을 이끈 경험", headline: "검색 품질 개선을 이끈 경험" },
  { id: "body", title: "사용자 조사", summary: "", headline: "사용자 인터뷰를 진행했어요.", custom: [{ key: "body", entryType: "field", type: "text", label: "본문", value: { type: "text", text: "사용자 인터뷰를 진행했어요. 다음 실험을 설계했어요." } }] },
  { id: "empty", title: "새로운 경험", summary: "", headline: "지표를 추가하면 카드가 더 잘 보여요" },
  { id: "long", title: "장기 프로젝트 성과", summary: longHeadline, headline: longHeadline },
];

for (const width of [1440, 390]) {
  test(`headline precedence, fallbacks and controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubApi(page, { authed: true });
    await page.route(`${STUB_API_URL}/experiences/`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      const seed = experienceList("data").data.contents[0];
      const contents = cases.map(item => ({ ...seed, id: `headline-${item.id}`, type: item.type ?? "career", importance: null,
        content: { schema_version: 2, template_version: 99, title: item.title, summary: item.summary,
          status: "complete", tags: [], fields: item.fields ?? {}, custom: item.custom ?? [] } }));
      await route.fulfill({ json: success({ count: contents.length, contents }), headers: corsHeaders(route.request().headers()["origin"] ?? "http://localhost:3000") });
    });
    await page.goto("/archive");
    for (const item of cases) {
      const card = page.locator(`[role="button"][data-experience-id="headline-${item.id}"]:visible`);
      await expect(card.getByRole("heading", { name: item.title, exact: true })).toBeVisible();
      await expect(card.locator("p")).toHaveText(item.headline);
      await expect(card.getByText(EXPERIENCE_TYPE_MAP[(item.type ?? "career") as keyof typeof EXPERIENCE_TYPE_MAP].label, { exact: true })).toBeVisible();
      for (const label of [EXPERIENCE_TYPE_MAP[(item.type ?? "career") as keyof typeof EXPERIENCE_TYPE_MAP].label, "완료"]) {
        const colors = await card.getByText(label, { exact: true }).evaluate(el => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-text-tertiary)";
          el.append(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          return { actual: getComputedStyle(el).color, expected };
        });
        expect(colors.actual).toBe(colors.expected);
      }
      const line = card.locator("p");
      const geometry = await line.evaluate(el => ({
        right: el.getBoundingClientRect().right, cardRight: el.closest("[data-experience-id]")!.getBoundingClientRect().right,
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, style: getComputedStyle(el).textOverflow,
        whiteSpace: getComputedStyle(el).whiteSpace, fontWeight: Number(getComputedStyle(el).fontWeight),
      }));
      expect(geometry.right).toBeLessThanOrEqual(geometry.cardRight);
      expect(geometry.style).toBe("ellipsis");
      expect(geometry.whiteSpace).toBe("nowrap");
      expect(geometry.fontWeight).toBe(item.id === "empty" ? 400 : 500);
      if (item.id === "long") expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    }
    await expect(page.locator('[role="button"][data-experience-id="headline-metric"]:visible')).not.toContainText("중복하지 않을 요약");
    await expect(page.locator('[role="button"][data-experience-id="headline-body"]:visible')).not.toContainText("다음 실험");
    if (process.env.FRT84_CAPTURE_DIR) {
      await mkdir(process.env.FRT84_CAPTURE_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.FRT84_CAPTURE_DIR}/archive-${width}x900.jpg`, type: "jpeg", quality: 70, animations: "disabled" });
      await page.locator('[role="button"][data-experience-id="headline-long"]:visible').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.FRT84_CAPTURE_DIR}/archive-${width}x900-long.jpg`, type: "jpeg", quality: 70, animations: "disabled" });
    }
    const metric = page.locator('[role="button"][data-experience-id="headline-metric"]:visible');
    await metric.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await metric.getByLabel("더보기").click();
    await expect(page.locator("[data-archive-popover]").getByRole("button", { name: "편집", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-archive-popover]")).toHaveCount(0);
    await metric.click();
    if (width >= 1024) await expect(metric).toHaveAttribute("aria-pressed", "true");
    else await expect(page.getByRole("heading", { name: "서비스 전환 개선", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/id=headline-metric/);
  });
}

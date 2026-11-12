import { expect, test } from "@playwright/test";
import { stubApi, corsHeaders, STUB_API_URL } from "./fixtures/stub-api";
import { success } from "./fixtures/api-data";

// Synthetic records only: keep the entire GET → edit → save → GET boundary under a local stub.
for (const width of [1440, 390]) {
  test(`FRT-290 structured cells stay locked and survive save/reload (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await stubApi(page, { authed: true });
    const structured = { type: "date", date: "2026-08-12", future: { precision: "day" } };
    let content: Record<string, unknown> = {
      schema_version: 2, title: "보존 검증 기록", summary: "합성 데이터", status: "draft", tags: [], fields: {},
      custom: [{ entryType: "section", key: "preserve", label: "보존 검증", children: [
        { entryType: "field", key: "structured", label: "구조값 보존 표", type: "repeatable-cell", value: {
          type: "repeatable-cell", columns: [{ key: "item", label: "항목", blockType: "text" }],
          rows: [{ id: "row-1", cells: { item: structured } }],
        } },
        { entryType: "field", key: "future", label: "미래 숫자", type: "rating-v3", value: 5 },
        { entryType: "field", key: "ordinary", label: "일반 입력", type: "text", value: { type: "text", text: "수정 가능" } },
      ] }],
    };
    let saved: Record<string, unknown> | undefined;
    await page.route(`${STUB_API_URL}/experiences/frt290-preview`, async route => {
      const headers = corsHeaders(new URL(page.url()).origin);
      if (route.request().method() === "GET") {
        await route.fulfill({ json: success({ id: "frt290-preview", user_id: "e2e-user", type: "career", importance: null,
          content, created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z" }), headers });
      } else if (["PATCH", "PUT"].includes(route.request().method())) {
        saved = route.request().postDataJSON();
        content = saved!.content as Record<string, unknown>;
        await route.fulfill({ json: success(null), headers });
      } else await route.fallback();
    });
    const check = async () => {
      const label = page.getByText("구조값 보존 표", { exact: true });
      await expect(label).toBeVisible();
      const block = label.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group ")][1]');
      await expect(block.locator("input, textarea, select")).toHaveCount(0);
      await expect(block.getByRole("button", { name: "블록 편집", exact: true })).toHaveCount(0);
      await expect(page.getByLabel("일반 입력", { exact: true })).toHaveValue("수정 가능");
    };
    await page.goto("/archive/frt290-preview/edit");
    await check();
    await page.getByText("구조값 보존 표", { exact: true }).scrollIntoViewIfNeeded();
    await testInfo.attach(`frt290-${width}px`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await expect.poll(() => saved).toBeTruthy();
    const custom = content.custom as Array<{ children: Array<{ key: string; type: string; value: unknown }> }>;
    expect(custom[0].children.find(field => field.key === "future")).toMatchObject({ type: "rating-v3", value: 5 });
    expect(custom[0].children.find(field => field.key === "structured")?.value).toMatchObject({
      rows: [{ cells: { item: structured } }],
    });
    await page.goto("/archive/frt290-preview/edit");
    await check();
  });
}

for (const width of [1440, 390]) {
  test(`FRT-290 recovers template columns before rendering (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await stubApi(page, { authed: true });
    await page.route(`${STUB_API_URL}/experiences/frt290-definitions`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        headers: corsHeaders(new URL(page.url()).origin),
        json: success({ id: "frt290-definitions", user_id: "e2e-user", type: "career", importance: null,
          created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z", content: {
            title: "정의 복구 검증", status: "draft", customBlocks: [],
            coreBlocks: [
              { id: "future-null", key: "future.null", label: "미래의 빈 값", type: "rating-v3", value: null, variant: "outcome-list" },
              { id: "conditional", key: "future.dependent", label: "조건부 입력", type: "text",
                value: { type: "text", text: "조건이 맞으면 표시" }, visibleWhen: { key: "future.null" } },
            ],
            extensionBlocks: [{ id: "broken", key: "career-tasks.프로젝트/담당 업무", label: "옛 라벨", type: null,
              value: { type: "repeatable-cell", rows: [{ id: "r1", cells: { project: "보존된 프로젝트" } }] } }],
          },
        }),
      });
    });
    await page.goto("/archive/frt290-definitions/edit");
    const project = page.getByPlaceholder("예: 2025 상반기 신제품 런칭 SNS 캠페인").first();
    await expect(project).toHaveValue("보존된 프로젝트");
    await expect(project).toBeEditable();
    await project.scrollIntoViewIfNeeded();
    await testInfo.attach(`frt290-definitions-${width}px`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}

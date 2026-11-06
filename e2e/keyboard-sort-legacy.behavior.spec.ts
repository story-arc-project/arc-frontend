import { expect, test } from "@playwright/test";
import { corsHeaders, STUB_API_URL, stubApi } from "./fixtures/stub-api";

// Legacy loose custom blocks coexist with another sortable section. This is a
// browser/API-mock regression, not real-server or physical-touch evidence.
test("legacy loose keyboard/pointer order stays isolated and saves exact order", async ({ page }) => {
  const stub = await stubApi(page, { authed: true });
  const text = (id: string, label: string) => ({ id, type: "text", label, value: { type: "text", text: label } });
  await page.route(`${STUB_API_URL}/experiences/exp-e2e-1`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ headers: corsHeaders(route.request().headers().origin ?? ""), json: {
      status: "success", message: "ok", data: {
        id: "exp-e2e-1", user_id: "e2e", type: "club", importance: null,
        content: { title: "레거시 순서 검증", summary: "", status: "draft", tags: [], coreBlocks: [], extensionBlocks: [],
          customBlocks: [
            { id: "section", type: "group", label: "독립 섹션", value: { type: "group" }, children: [text("child-a", "섹션 첫째"), text("child-b", "섹션 둘째")] },
            text("loose-a", "레거시 첫째"), text("loose-b", "레거시 둘째"),
          ],
        }, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z",
      },
    } });
  });
  await page.goto("/archive/exp-e2e-1/edit");
  const loose = page.locator("section").filter({ has: page.getByRole("heading", { name: "기타", exact: true }) });
  const isolated = page.locator("section").filter({ has: page.getByLabel("섹션 이름") });
  const handles = loose.getByRole("button", { name: "드래그하여 순서 변경" });
  const values = () => loose.getByRole("textbox").evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value));
  await expect(handles).toHaveCount(2);
  await expect(isolated.getByRole("textbox").nth(1)).toHaveValue("섹션 첫째");
  await handles.first().focus();
  const instructionId = await handles.first().getAttribute("aria-describedby");
  expect(instructionId).toBeTruthy();
  await expect(page.locator(`[id="${instructionId}"]`)).toContainText("Escape로 취소");
  await page.keyboard.press("Space", { delay: 150 });
  await expect(handles.first()).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown", { delay: 150 });
  await expect(page.getByRole("status").filter({ hasText: "2번째 위치" })).toHaveCount(1);
  await page.keyboard.press("Space", { delay: 150 });
  await expect.poll(values).toEqual(["레거시 둘째", "레거시 첫째"]);
  await expect(handles.nth(1)).toBeFocused();
  await expect(isolated.getByRole("textbox").nth(1)).toHaveValue("섹션 첫째");
  await page.keyboard.press("Enter", { delay: 150 });
  await expect(handles.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp", { delay: 150 });
  await page.keyboard.press("Escape");
  await expect.poll(values).toEqual(["레거시 둘째", "레거시 첫째"]);
  await expect(handles.nth(1)).toBeFocused();
  // PointerSensor retains its 8px activation threshold.
  await handles.first().scrollIntoViewIfNeeded();
  const start = await handles.first().boundingBox();
  const end = await handles.nth(1).boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2 + 4);
  await expect(handles.first()).not.toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 10 });
  await expect(handles.first()).toHaveAttribute("aria-pressed", "true");
  await page.mouse.up();
  await expect.poll(values).toEqual(["레거시 첫째", "레거시 둘째"]);
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.waitForURL(/\/archive\?id=exp-e2e-1/);
  const save = stub.mutations.find(m => m.method === "PUT" && m.path === "/experiences/exp-e2e-1");
  expect(save?.body).toMatchObject({ content: { custom: [
    { label: "독립 섹션", children: [{ label: "섹션 첫째" }, { label: "섹션 둘째" }] },
    { label: "레거시 첫째" }, { label: "레거시 둘째" },
  ] } });
});

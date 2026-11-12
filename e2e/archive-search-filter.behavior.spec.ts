import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { stubApi } from "./fixtures/stub-api"

const TITLE = "캡스톤 팀 프로젝트"
const searchControl = (page: Page) => page.locator("[data-archive-search]").filter({ visible: true })
const searchInput = (page: Page) => page.getByRole("textbox", { name: "경험 검색", exact: true }).filter({ visible: true })

async function capture(page: Page, testInfo: TestInfo, state: string) {
  const directory = process.env.FRT85_PREVIEW_DIR ?? "e2e/preview/out"
  await mkdir(directory, { recursive: true })
  const body = await page.screenshot({ path: path.join(directory, `frt85-${page.viewportSize()?.width}-${state}.jpg`), type: "jpeg", quality: 75, animations: "disabled" })
  await testInfo.attach(state, { body, contentType: "image/jpeg" })
}

for (const width of [776, 1440]) {
  test(`search geometry and keyboard Clear survive preview at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await stubApi(page, { authed: true, scenario: "data" })
    await page.goto("/archive")
    const input = searchInput(page)
    const control = searchControl(page)
    await expect(input).toBeVisible()
    const before = { input: await input.boundingBox(), control: await control.boundingBox() }
    await page.getByRole("heading", { level: 3, name: TITLE }).click()
    await expect(page.getByRole("button", { name: "미리보기 닫기", exact: true })).toBeVisible()
    expect((await input.boundingBox())?.width).toBe(before.input?.width)
    expect((await control.boundingBox())?.width).toBe(before.control?.width)
    await input.fill("캡스톤")
    await expect(page.getByRole("heading", { level: 3, name: TITLE })).toBeVisible()
    await expect(page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" })).toHaveCount(0)
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("캡스톤")
    await capture(page, testInfo, "preview-search")
    await input.press("Tab")
    await expect(page.getByRole("button", { name: "검색어 지우기" }).filter({ visible: true })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
    await expect(page.getByRole("heading", { level: 3, name: "교내 개발 동아리 운영진" })).toBeVisible()
    await page.getByRole("button", { name: "미리보기 닫기", exact: true }).click()
    expect((await input.boundingBox())?.width).toBe(before.input?.width)
    expect((await control.boundingBox())?.width).toBe(before.control?.width)
  })
}

for (const width of [390, 776, 1440]) {
  test(`many filter tokens scroll without page overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await stubApi(page, { authed: true, scenario: "data" })
    const params = new URLSearchParams({ q: "캡스톤", type: "career,project,club,award,extracurricular,education", status: "draft,complete", sort: "period" })
    await page.goto(`/archive?${params}`)
    const input = searchInput(page)
    await expect(input).toHaveValue("캡스톤")
    const tokens = page.getByRole("group", { name: "적용된 필터" }).filter({ visible: true })
    await expect(tokens).toBeVisible()
    const metrics = await tokens.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, height: element.clientHeight }))
    expect(metrics.scroll).toBeGreaterThan(metrics.width)
    expect(metrics.height).toBeLessThanOrEqual(42)
    expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(64)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await capture(page, testInfo, "tokens")
    const clear = page.getByRole("button", { name: "검색어 지우기" }).filter({ visible: true })
    await clear.focus()
    await page.keyboard.press("Space")
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(null)
    expect(new URL(page.url()).searchParams.get("status")).toBe("draft,complete")
    expect(new URL(page.url()).searchParams.get("sort")).toBe("period")
    const complete = tokens.getByRole("button", { name: "완료 필터 해제", exact: true })
    await complete.focus()
    await page.keyboard.press("Enter")
    await expect(complete).toHaveCount(0)
    await expect(input).toBeFocused()
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("draft")
    expect(new URL(page.url()).searchParams.get("sort")).toBe("period")
  })
}

test("retired type and tag URL filters remain visible and survive search Clear", async ({ page }) => {
  await stubApi(page, { authed: true, scenario: "data" })
  await page.goto("/archive?type=sports&tags=React&q=검색")
  const tokens = page.getByRole("group", { name: "적용된 필터" }).filter({ visible: true })
  await expect(tokens.getByRole("button", { name: "운동 및 신체 역량 필터 해제" })).toBeVisible()
  await expect(tokens.getByText("태그: React", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "검색어 지우기" }).filter({ visible: true }).click()
  await expect(searchInput(page)).toHaveValue("")
  await expect(searchInput(page)).toBeFocused()
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(null)
  expect(new URL(page.url()).searchParams.get("type")).toBe("sports")
  expect(new URL(page.url()).searchParams.getAll("tags")).toEqual(["React"])
})

import { expect, test } from "@playwright/test"
import { stubApi } from "./fixtures/stub-api"

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`archive filter chips expose selection and preserve filtering at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await stubApi(page, { authed: true, scenario: "data" })
    await page.goto("/archive")
    await page.getByRole("button", { name: "필터", exact: true }).filter({ visible: true }).click()
    const chip = (name: string) => page.getByRole("button", { name, exact: true }).filter({ visible: true })
    const complete = chip("완료")
    const draft = chip("작성 중")
    const club = chip("동아리/교내 단체")
    await expect(complete).toHaveAttribute("aria-pressed", "false")
    await expect(draft).toHaveAttribute("aria-pressed", "false")
    await expect(club).toHaveAttribute("aria-pressed", "false")
    await complete.focus()
    await page.keyboard.press("Space")
    await expect(complete).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("heading", { name: "교내 개발 동아리 운영진", exact: true })).toBeVisible()
    await expect(page.getByText("캡스톤 팀 프로젝트", { exact: true })).toHaveCount(0)
    await club.focus()
    await page.keyboard.press("Enter")
    await expect(club).toHaveAttribute("aria-pressed", "true")
    await expect(draft).toHaveAttribute("aria-pressed", "false")
    if (process.env.FRT276_PREVIEW_DIR) {
      await page.screenshot({ path: `${process.env.FRT276_PREVIEW_DIR}/archive-${viewport.width}-selected.jpg`, fullPage: true, type: "jpeg", quality: 80, animations: "disabled" })
    }
    await page.keyboard.press("Enter")
    await expect(club).toHaveAttribute("aria-pressed", "false")
    await chip("필터 초기화").click()
    await expect(complete).toHaveAttribute("aria-pressed", "false")
    await expect(club).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByRole("heading", { name: "캡스톤 팀 프로젝트", exact: true })).toBeVisible()
    if (process.env.FRT276_PREVIEW_DIR) {
      await page.screenshot({ path: `${process.env.FRT276_PREVIEW_DIR}/archive-${viewport.width}-reset.jpg`, fullPage: true, type: "jpeg", quality: 80, animations: "disabled" })
    }
  })
}

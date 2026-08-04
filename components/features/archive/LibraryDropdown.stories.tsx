import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, waitFor, within } from "storybook/test"

import LibraryDropdown from "./LibraryDropdown"
import {
  systemLibrary,
  customLibrary,
  sampleLibraries,
  uncoloredLibrary,
  careerExperience,
  draftExperience,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof LibraryDropdown> = {
  title: "Features/Archive/LibraryDropdown",
  component: LibraryDropdown,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelectLibrary: () => {},
    onCreateLibrary: () => {},
    onRenameLibrary: () => {},
    onDeleteLibrary: () => {},
    onUpdateLibraryColor: () => {},
  },
}

export default meta

type Story = StoryObj<typeof LibraryDropdown>

export const Empty: Story = {
  args: {
    libraries: [systemLibrary],
    activeLibraryId: systemLibrary.id,
    experiences: [],
  },
}

export const WithData: Story = {
  args: {
    libraries: sampleLibraries,
    activeLibraryId: sampleLibraries[0].id,
    experiences: [careerExperience, draftExperience],
  },
}

export const CustomLibraryActive: Story = {
  args: {
    libraries: sampleLibraries,
    activeLibraryId: sampleLibraries[1].id,
    experiences: [careerExperience, draftExperience],
  },
}

/**
 * 색을 지정하지 않은 라이브러리의 점은 하드코딩 hex 가 아니라 토큰에서 색을 받아야 한다(FRT-128).
 *
 * 색이 있는 행을 대조군으로 함께 단언한다 — 폴백 클래스만 확인하면 "인라인 style 을 없애버려
 * 모든 라이브러리가 회색이 된" 회귀도 통과해버린다. 두 행이 서로 다른 경로를 타는지까지 본다.
 */
export const UncoloredLibraryUsesTokenFallback: Story = {
  args: {
    libraries: [systemLibrary, customLibrary, uncoloredLibrary],
    activeLibraryId: systemLibrary.id,
    experiences: [careerExperience, draftExperience],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { expanded: false }))

    const popover = await waitFor(() => {
      const el = document.body.querySelector<HTMLElement>("[data-archive-popover]")
      if (!el) throw new Error("library popover did not open")
      return el
    })

    function swatchOf(name: string): HTMLElement {
      const row = within(popover).getByText(name).closest<HTMLElement>("[role='button']")
      if (!row) throw new Error(`library row not found: ${name}`)
      const swatch = row.querySelector<HTMLElement>(".rounded-full")
      if (!swatch) throw new Error(`color swatch not found: ${name}`)
      return swatch
    }

    // 색 미지정 → 인라인 style 없이 토큰 클래스로 칠해진다.
    const uncolored = swatchOf(uncoloredLibrary.name)
    await expect(uncolored).toHaveClass("bg-text-secondary")
    await expect(uncolored.style.backgroundColor).toBe("")
    // 토큰이 실제로 색을 만들어내는지 — 클래스만 있고 투명하면 화면에선 사라진 것과 같다.
    await expect(getComputedStyle(uncolored).backgroundColor).toBe("rgb(107, 118, 132)")

    // 색 지정 → 사용자 색이 인라인 style 로 유지되고 폴백 클래스는 붙지 않는다.
    const colored = swatchOf(customLibrary.name)
    await expect(colored).not.toHaveClass("bg-text-secondary")
    await expect(getComputedStyle(colored).backgroundColor).toBe("rgb(59, 130, 246)")
  },
}

/**
 * 시스템 라이브러리("전체")는 사용자가 이름변경·삭제·색상변경할 수 없어야 한다(FRT-159).
 * 커스텀 라이브러리 행을 대조군으로 함께 단언한다 — 그래야 부재 단언이
 * 선택자 오타로 항상 통과하는 위양성이 되지 않는다.
 */
export const SystemLibraryHasNoEditActions: Story = {
  args: {
    libraries: sampleLibraries,
    activeLibraryId: systemLibrary.id,
    experiences: [careerExperience, draftExperience],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { expanded: false }))

    // 팝오버는 body 로 portal 된다 — canvasElement 안에 없다.
    const popover = await waitFor(() => {
      const el = document.body.querySelector<HTMLElement>("[data-archive-popover]")
      if (!el) throw new Error("library popover did not open")
      return el
    })

    function rowOf(name: string): HTMLElement {
      const row = within(popover).getByText(name).closest<HTMLElement>("[role='button']")
      if (!row) throw new Error(`library row not found: ${name}`)
      return row
    }

    const systemRow = within(rowOf(systemLibrary.name))
    await expect(systemRow.queryByRole("button", { name: "이름 변경" })).toBeNull()
    await expect(systemRow.queryByRole("button", { name: "삭제" })).toBeNull()
    await expect(systemRow.queryByRole("button", { name: "색상 변경" })).toBeNull()

    const customRow = within(rowOf(customLibrary.name))
    await expect(customRow.getByRole("button", { name: "이름 변경" })).toBeVisible()
    await expect(customRow.getByRole("button", { name: "삭제" })).toBeVisible()
  },
}

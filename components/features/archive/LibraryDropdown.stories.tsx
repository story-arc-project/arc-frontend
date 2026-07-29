import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, waitFor, within } from "storybook/test"

import LibraryDropdown from "./LibraryDropdown"
import {
  systemLibrary,
  customLibrary,
  sampleLibraries,
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

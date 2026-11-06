import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { EditorCard, SortableList } from "@/app/(main)/export/resume/[versionId]/_components/editors/shared"

function ResumeSortableHarness() {
  const [items, setItems] = useState([{ id: 1, label: "첫 번째 활동" }, { id: 2, label: "두 번째 활동" }])
  return <SortableList items={items} onReorder={setItems} renderItem={(item, handle) => <EditorCard handle={handle} onDelete={() => {}}><input aria-label={item.label} defaultValue={item.label} /></EditorCard>} />
}

const meta: Meta<typeof ResumeSortableHarness> = {
  title: "Features/Export/ResumeSortableList",
  component: ResumeSortableHarness,
  parameters: { layout: "padded" },
}
export default meta
type Story = StoryObj<typeof ResumeSortableHarness>

export const KeyboardReorder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handles = () => canvas.getAllByRole("button", { name: "순서 변경" })
    const first = handles()[0]
    first.focus()
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard(" ")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{ArrowUp}")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
    // Typing Space in an editor input must not activate the sortable wrapper.
    const input = canvas.getByRole("textbox", { name: "첫 번째 활동" })
    await userEvent.click(input)
    await userEvent.keyboard(" ")
    await expect(input).toHaveValue("첫 번째 활동 ")
    await expect(first).not.toHaveAttribute("aria-pressed", "true")
  },
}

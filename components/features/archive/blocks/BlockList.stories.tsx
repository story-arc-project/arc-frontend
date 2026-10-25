import { useState, type ReactNode } from "react"
import { DndContext, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { expect, userEvent, within, waitFor } from "storybook/test"
import type { Block } from "@/types/archive"
import type { Meta, StoryObj } from "@storybook/nextjs"

import BlockList from "./BlockList"
import {
  textBlock,
  dateBlock,
  checklistBlock,
  tableBlock,
  emptyTextBlock,
} from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof BlockList> = {
  title: "Features/Archive/Blocks/BlockList",
  component: BlockList,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof BlockList>

export const Empty: Story = {
  args: {
    blocks: [],
    readOnly: false,
    allowAdd: false,
  },
}

export const ReadOnly: Story = {
  args: {
    blocks: [textBlock, dateBlock, checklistBlock, tableBlock],
    readOnly: true,
  },
}

export const Editable: Story = {
  args: {
    blocks: [emptyTextBlock, dateBlock],
    readOnly: false,
  },
}

export const WithAddAndReorder: Story = {
  args: {
    blocks: [textBlock, checklistBlock],
    readOnly: false,
    allowAdd: true,
    allowReorder: true,
    allowDelete: true,
  },
}


function KeyboardHarness() {
  const [blocks, setBlocks] = useState<Block[]>([textBlock, checklistBlock])
  return <BlockList blocks={blocks} allowReorder onChange={setBlocks} />
}

export const KeyboardReorder: Story = {
  render: () => <KeyboardHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handles = () => canvas.getAllByRole("button", { name: "드래그하여 순서 변경" })
    const first = handles()[0]
    first.focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowUp}")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
  },
}

export const ReorderDisabled: Story = {
  args: { blocks: [textBlock, checklistBlock], allowReorder: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "드래그하여 순서 변경" })).not.toBeInTheDocument()
  },
}

export const ReadOnlyReorderDisabled: Story = {
  args: { blocks: [textBlock, checklistBlock], allowReorder: true, readOnly: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "드래그하여 순서 변경" })).not.toBeInTheDocument()
  },
}

// A synthetic enclosing sortable host verifies nested context isolation. Actual
// archive group blocks are not recursive BlockLists.
function OuterSortableHost({ children }: { children: ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useSortable({ id: "outer-host" })
  return (
    <div ref={setNodeRef}>
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label="외부 영역 순서 변경">외부 영역 순서 변경</button>
      {children}
    </div>
  )
}

function NestedKeyboardHarness() {
  const [blocks, setBlocks] = useState<Block[]>([textBlock, checklistBlock])
  const [innerChanges, setInnerChanges] = useState(0)
  const [outerStarts, setOuterStarts] = useState(0)
  const [outerDrops, setOuterDrops] = useState(0)
  const sensors = useSensors(useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  return (
    <DndContext sensors={sensors} onDragStart={() => setOuterStarts(n => n + 1)} onDragEnd={() => setOuterDrops(n => n + 1)}>
      <SortableContext items={["outer-host"]}>
        <OuterSortableHost>
          <BlockList blocks={blocks} allowReorder onChange={next => { setBlocks(next); setInnerChanges(n => n + 1) }} />
        </OuterSortableHost>
      </SortableContext>
      <output aria-label="내부 순서 저장 횟수">{innerChanges}</output>
      <output aria-label="외부 드래그 시작 횟수">{outerStarts}</output>
      <output aria-label="외부 순서 저장 횟수">{outerDrops}</output>
    </DndContext>
  )
}

export const NestedKeyboardReorder: Story = {
  render: () => <NestedKeyboardHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handles = () => canvas.getAllByRole("button", { name: "드래그하여 순서 변경" })
    const first = handles()[0]
    first.focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
    await expect(canvas.getByLabelText("내부 순서 저장 횟수")).toHaveTextContent("1")
    await expect(canvas.getByLabelText("외부 드래그 시작 횟수")).toHaveTextContent("0")
    await expect(canvas.getByLabelText("외부 순서 저장 횟수")).toHaveTextContent("0")
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowUp}")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(handles()[1]).toBe(first))
    await waitFor(() => expect(first).toHaveFocus())
    await expect(canvas.getByLabelText("내부 순서 저장 횟수")).toHaveTextContent("1")
    await expect(canvas.getByLabelText("외부 드래그 시작 횟수")).toHaveTextContent("0")
    await expect(canvas.getByLabelText("외부 순서 저장 횟수")).toHaveTextContent("0")
  },
}

import type { Meta, StoryObj } from "@storybook/nextjs"

import BlockRenderer from "./BlockRenderer"
import {
  textBlock,
  emptyTextBlock,
  dateBlock,
  emptyDateBlock,
  checklistBlock,
  emptyChecklistBlock,
  tableBlock,
  emptyTableBlock,
} from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof BlockRenderer> = {
  title: "Features/Archive/Blocks/BlockRenderer",
  component: BlockRenderer,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof BlockRenderer>

export const TextBlockEditable: Story = {
  args: {
    block: emptyTextBlock,
    readOnly: false,
  },
}

export const TextBlockReadOnly: Story = {
  args: {
    block: textBlock,
    readOnly: true,
  },
}

export const DateBlockEditable: Story = {
  args: {
    block: emptyDateBlock,
    readOnly: false,
  },
}

export const DateBlockReadOnly: Story = {
  args: {
    block: dateBlock,
    readOnly: true,
  },
}

export const ChecklistEditable: Story = {
  args: {
    block: checklistBlock,
    readOnly: false,
  },
}

export const ChecklistReadOnly: Story = {
  args: {
    block: checklistBlock,
    readOnly: true,
  },
}

export const TableEditable: Story = {
  args: {
    block: tableBlock,
    readOnly: false,
  },
}

export const TableReadOnly: Story = {
  args: {
    block: tableBlock,
    readOnly: true,
  },
}

export const EmptyChecklist: Story = {
  args: {
    block: emptyChecklistBlock,
    readOnly: false,
  },
}

export const EmptyTable: Story = {
  args: {
    block: emptyTableBlock,
    readOnly: false,
  },
}

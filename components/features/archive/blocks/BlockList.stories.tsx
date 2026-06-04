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

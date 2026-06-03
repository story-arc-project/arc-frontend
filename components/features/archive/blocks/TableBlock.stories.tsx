import type { Meta, StoryObj } from "@storybook/nextjs"

import TableBlock from "./TableBlock"
import { tableBlock, emptyTableBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TableBlock> = {
  title: "Features/Archive/Blocks/TableBlock",
  component: TableBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TableBlock>

export const Empty: Story = {
  args: {
    block: emptyTableBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: tableBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: tableBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTableBlock,
    readOnly: true,
  },
}

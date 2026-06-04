import type { Meta, StoryObj } from "@storybook/nextjs"

import DateBlock from "./DateBlock"
import { dateBlock, emptyDateBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof DateBlock> = {
  title: "Features/Archive/Blocks/DateBlock",
  component: DateBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof DateBlock>

export const Empty: Story = {
  args: {
    block: emptyDateBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: dateBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: dateBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyDateBlock,
    readOnly: true,
  },
}

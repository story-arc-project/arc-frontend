import type { Meta, StoryObj } from "@storybook/nextjs"

import SingleSelectBlock from "./SingleSelectBlock"
import { singleSelectBlock, emptySingleSelectBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof SingleSelectBlock> = {
  title: "Features/Archive/Blocks/SingleSelectBlock",
  component: SingleSelectBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof SingleSelectBlock>

export const Empty: Story = {
  args: {
    block: emptySingleSelectBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptySingleSelectBlock,
    readOnly: true,
  },
}

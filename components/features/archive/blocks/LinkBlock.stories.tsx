import type { Meta, StoryObj } from "@storybook/nextjs"

import LinkBlock from "./LinkBlock"
import { linkBlock, emptyLinkBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof LinkBlock> = {
  title: "Features/Archive/Blocks/LinkBlock",
  component: LinkBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof LinkBlock>

export const Empty: Story = {
  args: {
    block: emptyLinkBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: linkBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: linkBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyLinkBlock,
    readOnly: true,
  },
}

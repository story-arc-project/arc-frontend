import type { Meta, StoryObj } from "@storybook/nextjs"

import TextBlock from "./TextBlock"
import { textBlock, emptyTextBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TextBlock> = {
  title: "Features/Archive/Blocks/TextBlock",
  component: TextBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TextBlock>

export const Empty: Story = {
  args: {
    block: emptyTextBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: textBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: textBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTextBlock,
    readOnly: true,
  },
}

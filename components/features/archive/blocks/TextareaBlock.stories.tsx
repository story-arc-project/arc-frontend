import type { Meta, StoryObj } from "@storybook/nextjs"

import TextareaBlock from "./TextareaBlock"
import { textareaBlock, emptyTextareaBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TextareaBlock> = {
  title: "Features/Archive/Blocks/TextareaBlock",
  component: TextareaBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TextareaBlock>

export const Empty: Story = {
  args: {
    block: emptyTextareaBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: textareaBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: textareaBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTextareaBlock,
    readOnly: true,
  },
}

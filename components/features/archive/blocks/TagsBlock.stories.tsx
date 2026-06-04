import type { Meta, StoryObj } from "@storybook/nextjs"

import TagsBlock from "./TagsBlock"
import { tagsBlock, emptyTagsBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TagsBlock> = {
  title: "Features/Archive/Blocks/TagsBlock",
  component: TagsBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TagsBlock>

export const Empty: Story = {
  args: {
    block: emptyTagsBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: tagsBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: tagsBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTagsBlock,
    readOnly: true,
  },
}

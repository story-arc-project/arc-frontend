import type { Meta, StoryObj } from "@storybook/nextjs"

import ChecklistBlock from "./ChecklistBlock"
import { checklistBlock, emptyChecklistBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof ChecklistBlock> = {
  title: "Features/Archive/Blocks/ChecklistBlock",
  component: ChecklistBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ChecklistBlock>

export const Empty: Story = {
  args: {
    block: emptyChecklistBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: checklistBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: checklistBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyChecklistBlock,
    readOnly: true,
  },
}

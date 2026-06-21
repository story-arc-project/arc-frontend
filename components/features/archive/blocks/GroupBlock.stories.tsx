import type { Meta, StoryObj } from "@storybook/nextjs"

import GroupBlock from "./GroupBlock"
import {
  groupBlock,
  emptyGroupBlock,
  collapsedGroupBlock,
} from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof GroupBlock> = {
  title: "Features/Archive/Blocks/GroupBlock",
  component: GroupBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof GroupBlock>

export const Default: Story = {
  args: {
    block: groupBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: groupBlock,
    readOnly: true,
  },
}

export const Collapsed: Story = {
  args: {
    block: collapsedGroupBlock,
    readOnly: false,
  },
}

export const Empty: Story = {
  args: {
    block: emptyGroupBlock,
    readOnly: false,
  },
}

export const WithAddReorder: Story = {
  args: {
    block: groupBlock,
    readOnly: false,
  },
}

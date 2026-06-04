import type { Meta, StoryObj } from "@storybook/nextjs"

import PeriodBlock from "./PeriodBlock"
import { periodBlock, periodBlockFinished, emptyPeriodBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof PeriodBlock> = {
  title: "Features/Archive/Blocks/PeriodBlock",
  component: PeriodBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof PeriodBlock>

export const Empty: Story = {
  args: {
    block: emptyPeriodBlock,
    readOnly: false,
  },
}

export const CurrentPeriod: Story = {
  args: {
    block: periodBlock,
    readOnly: false,
  },
}

export const FinishedPeriod: Story = {
  args: {
    block: periodBlockFinished,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: periodBlock,
    readOnly: true,
  },
}

export const ReadOnlyFinished: Story = {
  args: {
    block: periodBlockFinished,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyPeriodBlock,
    readOnly: true,
  },
}

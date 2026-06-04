import type { Meta, StoryObj } from "@storybook/nextjs"

import ImportanceSelector from "./ImportanceSelector"
import type { ImportanceLevel } from "@/types/archive"

const meta: Meta<typeof ImportanceSelector> = {
  title: "Features/Archive/ImportanceSelector",
  component: ImportanceSelector,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ImportanceSelector>

export const Unset: Story = {
  args: {
    value: undefined,
    size: "md",
  },
}

export const HighImportance: Story = {
  args: {
    value: 5 as ImportanceLevel,
    size: "md",
  },
}

export const MediumImportance: Story = {
  args: {
    value: 3 as ImportanceLevel,
    size: "md",
  },
}

export const LowImportance: Story = {
  args: {
    value: 1 as ImportanceLevel,
    size: "md",
  },
}

export const SmallSize: Story = {
  args: {
    value: 4 as ImportanceLevel,
    size: "sm",
  },
}

export const ReadOnly: Story = {
  args: {
    value: 4 as ImportanceLevel,
    readOnly: true,
    size: "md",
  },
}

export const ReadOnlyUnset: Story = {
  args: {
    value: undefined,
    readOnly: true,
    size: "md",
  },
}

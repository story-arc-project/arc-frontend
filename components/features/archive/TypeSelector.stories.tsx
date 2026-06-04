import type { Meta, StoryObj } from "@storybook/nextjs"

import TypeSelector from "./TypeSelector"

const meta: Meta<typeof TypeSelector> = {
  title: "Features/Archive/TypeSelector",
  component: TypeSelector,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelect: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TypeSelector>

/** Full picker grid — no type selected yet. */
export const NoneSelected: Story = {
  args: {
    selectedId: null,
  },
}

/** Collapsed chip view — a type is already chosen. */
export const Selected: Story = {
  args: {
    selectedId: "career",
  },
}

/** Collapsed chip view — disabled so the change button is hidden. */
export const SelectedDisabled: Story = {
  args: {
    selectedId: "personal-project",
    disabled: true,
  },
}

/** Full picker in disabled mode — all chips greyed out except the selected one. */
export const NoneSelectedDisabled: Story = {
  args: {
    selectedId: null,
    disabled: true,
  },
}

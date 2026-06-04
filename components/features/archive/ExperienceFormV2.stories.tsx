import type { Meta, StoryObj } from "@storybook/nextjs"

import ExperienceFormV2 from "./ExperienceFormV2"
import {
  careerExperience,
  mockPresetsHook,
  emptyPresetsHook,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof ExperienceFormV2> = {
  title: "Features/Archive/ExperienceFormV2",
  component: ExperienceFormV2,
  parameters: {
    layout: "padded",
  },
  args: {
    onSave: () => {},
    onCancel: () => {},
    onUnsavedChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ExperienceFormV2>

/** New experience — no type selected yet (empty state). */
export const NewEmpty: Story = {
  args: {
    mode: "new",
    initialExperience: undefined,
    presetsHook: emptyPresetsHook,
  },
}

/** New experience with presets available in the hook. */
export const NewWithPresets: Story = {
  args: {
    mode: "new",
    initialExperience: undefined,
    presetsHook: mockPresetsHook,
  },
}

/** Edit mode — pre-populated with a career experience. */
export const EditWithData: Story = {
  args: {
    mode: "edit",
    initialExperience: careerExperience,
    presetsHook: mockPresetsHook,
  },
}

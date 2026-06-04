import type { Meta, StoryObj } from "@storybook/nextjs"

import ExperienceDetailV2 from "./ExperienceDetailV2"
import { careerExperience, draftExperience } from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof ExperienceDetailV2> = {
  title: "Features/Archive/ExperienceDetailV2",
  component: ExperienceDetailV2,
  parameters: {
    layout: "padded",
  },
  args: {
    onEdit: () => {},
    onDelete: () => {},
    onDuplicate: () => {},
    onUpdateImportance: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ExperienceDetailV2>

export const WithData: Story = {
  args: {
    experience: careerExperience,
  },
}

export const DraftStatus: Story = {
  args: {
    experience: draftExperience,
  },
}

export const EmptyState: Story = {
  args: {
    experience: {
      ...careerExperience,
      id: "exp-empty-detail",
      title: "",
      summary: "",
      tags: [],
      importance: undefined,
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
    },
  },
}

export const ReadOnlyImportance: Story = {
  args: {
    experience: careerExperience,
    onUpdateImportance: undefined,
  },
}

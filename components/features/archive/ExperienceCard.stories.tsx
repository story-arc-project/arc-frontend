import type { Meta, StoryObj } from "@storybook/nextjs"

import ExperienceCard from "./ExperienceCard"
import {
  careerExperience,
  draftExperience,
  sampleLibraries,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof ExperienceCard> = {
  title: "Features/Archive/ExperienceCard",
  component: ExperienceCard,
  parameters: {
    layout: "padded",
  },
  args: {
    onClick: () => {},
    onEdit: () => {},
    onDuplicate: () => {},
    onDelete: () => {},
    onMoveToLibrary: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ExperienceCard>

export const Default: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: sampleLibraries,
  },
}

export const Selected: Story = {
  args: {
    experience: careerExperience,
    selected: true,
    libraries: sampleLibraries,
  },
}

export const Draft: Story = {
  args: {
    experience: draftExperience,
    selected: false,
    libraries: sampleLibraries,
  },
}

export const NoLibraries: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: undefined,
  },
}

export const EmptyState: Story = {
  args: {
    experience: {
      ...careerExperience,
      id: "exp-empty",
      title: "",
      summary: "",
      tags: [],
      importance: undefined,
    },
    selected: false,
    libraries: [],
  },
}

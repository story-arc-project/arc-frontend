import type { Meta, StoryObj } from "@storybook/nextjs"

import LibrarySidebar from "./LibrarySidebar"
import {
  systemLibrary,
  sampleLibraries,
  careerExperience,
  draftExperience,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof LibrarySidebar> = {
  title: "Features/Archive/LibrarySidebar",
  component: LibrarySidebar,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onSelectLibrary: () => {},
    onCreateLibrary: () => {},
    onRenameLibrary: () => {},
    onDeleteLibrary: () => {},
    onUpdateLibraryColor: () => {},
    onNewExperience: () => {},
  },
}

export default meta

type Story = StoryObj<typeof LibrarySidebar>

export const Empty: Story = {
  args: {
    libraries: [systemLibrary],
    activeLibraryId: systemLibrary.id,
    experiences: [],
  },
}

export const WithData: Story = {
  args: {
    libraries: sampleLibraries,
    activeLibraryId: sampleLibraries[0].id,
    experiences: [careerExperience, draftExperience],
  },
}

export const CustomLibraryActive: Story = {
  args: {
    libraries: sampleLibraries,
    activeLibraryId: sampleLibraries[1].id,
    experiences: [careerExperience, draftExperience],
  },
}

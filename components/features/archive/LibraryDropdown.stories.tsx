import type { Meta, StoryObj } from "@storybook/nextjs"

import LibraryDropdown from "./LibraryDropdown"
import {
  systemLibrary,
  sampleLibraries,
  careerExperience,
  draftExperience,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof LibraryDropdown> = {
  title: "Features/Archive/LibraryDropdown",
  component: LibraryDropdown,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelectLibrary: () => {},
    onCreateLibrary: () => {},
    onRenameLibrary: () => {},
    onDeleteLibrary: () => {},
    onUpdateLibraryColor: () => {},
  },
}

export default meta

type Story = StoryObj<typeof LibraryDropdown>

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

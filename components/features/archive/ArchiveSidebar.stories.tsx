import type { Decorator, Meta, StoryObj } from "@storybook/nextjs"
import { DndContext } from "@dnd-kit/core"

import { ArchiveSidebar } from "./ArchiveSidebar"
import {
  sampleFolders,
  systemFolder,
  sampleLegacyExperiences,
  sampleTemplates,
} from "./__fixtures__/archive.fixtures"

/** Wrap each story in a parent DndContext per the issue spec. */
const withDndContext: Decorator = (Story) => (
  <DndContext>
    <Story />
  </DndContext>
)

const meta: Meta<typeof ArchiveSidebar> = {
  title: "Features/Archive/ArchiveSidebar",
  component: ArchiveSidebar,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withDndContext],
  args: {
    selectedId: null,
    onSelectExperience: () => {},
    onNewExperience: () => {},
    onAddFolder: () => {},
    onRenameFolder: () => {},
    onDeleteFolder: () => {},
    onMoveExperience: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ArchiveSidebar>

export const Empty: Story = {
  args: {
    folders: [systemFolder],
    experiences: [],
    templates: sampleTemplates,
  },
}

export const WithData: Story = {
  args: {
    folders: sampleFolders,
    experiences: sampleLegacyExperiences,
    templates: sampleTemplates,
  },
}

export const ItemSelected: Story = {
  args: {
    folders: sampleFolders,
    experiences: sampleLegacyExperiences,
    templates: sampleTemplates,
    selectedId: sampleLegacyExperiences[0].id,
  },
}

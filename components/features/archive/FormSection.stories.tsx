import type { Meta, StoryObj } from "@storybook/nextjs"

import FormSection from "./FormSection"
import { careerExperience } from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof FormSection> = {
  title: "Features/Archive/FormSection",
  component: FormSection,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof FormSection>

export const Expanded: Story = {
  args: {
    label: "핵심 정보",
    blocks: careerExperience.coreBlocks,
    defaultCollapsed: false,
    readOnly: false,
    allowAdd: true,
    allowReorder: true,
    allowDelete: true,
  },
}

export const Collapsed: Story = {
  args: {
    label: "추가 정보",
    blocks: careerExperience.extensionBlocks,
    defaultCollapsed: true,
    readOnly: false,
    allowAdd: true,
    allowReorder: true,
    allowDelete: true,
  },
}

export const ReadOnly: Story = {
  args: {
    label: "핵심 정보",
    blocks: careerExperience.coreBlocks,
    defaultCollapsed: false,
    readOnly: true,
  },
}

export const EmptyBlocks: Story = {
  args: {
    label: "커스텀 블록",
    blocks: [],
    defaultCollapsed: false,
    allowAdd: true,
  },
}

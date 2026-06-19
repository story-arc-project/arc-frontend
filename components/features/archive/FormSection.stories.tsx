import type { Meta, StoryObj } from "@storybook/nextjs"

import FormSection from "./FormSection"
import { careerExperience } from "./__fixtures__/archive.fixtures"
import { createTextField, createTextareaField } from "@/lib/utils/block-utils"

const sampleBlocks = [
  createTextField("회사명", { required: true }),
  createTextareaField("지원 동기"),
]

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

export const Card: Story = {
  args: { variant: "card", label: "기본 정보", sectionId: "basic", blocks: sampleBlocks },
}

export const CardOptional: Story = {
  args: {
    variant: "card",
    label: "경험 상세",
    sectionId: "detail",
    optional: true,
    description: "채울수록 분석이 정확해져요",
    showOptionalBadge: true,
    blocks: sampleBlocks,
  },
}

export const Collapsible: Story = {
  args: { variant: "collapsible", label: "반복 기록", defaultCollapsed: true, blocks: sampleBlocks },
}

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

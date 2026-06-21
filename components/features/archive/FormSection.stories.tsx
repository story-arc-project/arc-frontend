import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"

import FormSection from "./FormSection"
import { careerExperience } from "./__fixtures__/archive.fixtures"
import { createGroupBlock, createTextField, createTextareaField } from "@/lib/utils/block-utils"
import type { Block } from "@/types/archive"

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

function EditableHarness({ readOnly }: { readOnly?: boolean }) {
  const section = createGroupBlock("나만의 섹션")
  const f = createTextField("메모"); if (f.value.type === "text") f.value.text = "내용"
  section.children = [f]
  const [blocks, setBlocks] = useState<Block[]>(section.children ?? [])
  const [label, setLabel] = useState(section.label)
  return (
    <FormSection
      variant="card"
      sectionId={section.id}
      label={label}
      blocks={blocks}
      readOnly={readOnly}
      editableLabel={!readOnly}
      onLabelChange={setLabel}
      onDelete={() => {}}
      allowAdd={!readOnly}
      allowReorder={!readOnly}
      allowDelete={!readOnly}
      onChange={setBlocks}
    />
  )
}

export const UserSectionEditable: Story = { render: () => <EditableHarness /> }
export const UserSectionReadOnly: Story = { render: () => <EditableHarness readOnly /> }
export const FixedCard: Story = {
  args: {
    variant: "card",
    label: "기본 정보",
    blocks: [createTextField("회사명")],
    onChange: () => {},
  },
}

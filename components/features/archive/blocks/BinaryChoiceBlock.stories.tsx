import type { Meta, StoryObj } from "@storybook/nextjs"

import BinaryChoiceBlock from "./BinaryChoiceBlock"
import { createBinaryChoiceField } from "@/lib/utils/block-utils"
import type { Block, SingleSelectBlockValue } from "@/types/archive"

const base = createBinaryChoiceField(
  "실행 방식",
  ["계획을 세운 뒤 실행", "상황에 맞게 유연하게 대응"],
  { guide: "각 항목에서 나에게 더 가까운 쪽을 클릭해주세요." },
)

function withSelected(selected: string): Block {
  return { ...base, value: { ...(base.value as SingleSelectBlockValue), selected } }
}

const meta: Meta<typeof BinaryChoiceBlock> = {
  title: "Features/Archive/Blocks/BinaryChoiceBlock",
  component: BinaryChoiceBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof BinaryChoiceBlock>

export const Empty: Story = {
  args: {
    block: base,
    readOnly: false,
  },
}

export const LeftSelected: Story = {
  args: {
    block: withSelected("계획을 세운 뒤 실행"),
    readOnly: false,
  },
}

export const RightSelected: Story = {
  args: {
    block: withSelected("상황에 맞게 유연하게 대응"),
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: withSelected("계획을 세운 뒤 실행"),
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: base,
    readOnly: true,
  },
}

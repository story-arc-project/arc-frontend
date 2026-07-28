import type { Meta, StoryObj } from "@storybook/nextjs"

import MoodTagBlock from "./MoodTagBlock"
import { createMoodTagField } from "@/lib/utils/block-utils"
import type { Block, ChecklistBlockValue } from "@/types/archive"

const MOOD_TAGS = [
  "🎨 창의적 표현",
  "🤝 팀 협업",
  "🏃 실행 중심",
  "🧠 학습 중심",
  "📣 홍보 / 콘텐츠",
  "🌍 사회 기여",
  "💼 실무 연계",
  "🚩 리더십",
  "🎯 목표 달성",
  "🌐 네트워킹",
  "🔥 도전적",
  "💡 아이디어 발산",
]

const base = createMoodTagField("활동 성격", MOOD_TAGS, {
  guide: "이 활동이 어떤 성격이었는지 태그로 표현해보세요. 여러 개 선택할 수 있어요.",
})

function withChecked(checked: string[]): Block {
  return { ...base, value: { ...(base.value as ChecklistBlockValue), checked } }
}

const meta: Meta<typeof MoodTagBlock> = {
  title: "Features/Archive/Blocks/MoodTagBlock",
  component: MoodTagBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof MoodTagBlock>

export const Empty: Story = {
  args: {
    block: base,
    readOnly: false,
  },
}

export const Selected: Story = {
  args: {
    block: withChecked(["🤝 팀 협업", "📣 홍보 / 콘텐츠", "🔥 도전적"]),
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: withChecked(["🤝 팀 협업", "📣 홍보 / 콘텐츠"]),
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: base,
    readOnly: true,
  },
}

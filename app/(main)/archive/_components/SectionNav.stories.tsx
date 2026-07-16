import type { Meta, StoryObj } from "@storybook/nextjs"
import { useRef } from "react"

import SectionNav from "./SectionNav"
import type { ExperienceFormV2Handle } from "@/components/features/archive/ExperienceFormV2"

const meta: Meta<typeof SectionNav> = {
  title: "Features/Archive/SectionNav",
  component: SectionNav,
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ref = useRef<ExperienceFormV2Handle | null>(null)
    return (
      <div className="w-56 p-4 bg-surface-primary">
        <SectionNav {...args} formRef={ref} />
      </div>
    )
  },
  args: {
    sections: [
      { id: "basic", label: "기본 정보" },
      { id: "detail", label: "경험 상세" },
      { id: "repeat", label: "반복 기록" },
      { id: "evidence", label: "활동 증빙" },
    ],
  },
}

export default meta
type Story = StoryObj<typeof SectionNav>

/** 기본 상태 — 첫 섹션이 활성화된다. */
export const Default: Story = {}

/** 저장 중 — 버튼이 비활성화된다. */
export const Saving: Story = {
  args: { saving: true },
}

/** 진행도 바 — 아무 섹션도 안 채운 상태 (0/4) (FRT-90). */
export const ProgressEmpty: Story = {
  args: { progress: { done: 0, total: 4 } },
}

/** 진행도 바 — 절반 완료 (2/4). 학회는 repeat 앵커가 '프로젝트 기록'으로 표시된다. */
export const ProgressHalf: Story = {
  args: {
    sections: [
      { id: "basic", label: "기본 정보" },
      { id: "detail", label: "경험 상세" },
      { id: "repeat", label: "프로젝트 기록" },
      { id: "evidence", label: "활동 증빙" },
    ],
    progress: { done: 2, total: 4 },
  },
}

/** 진행도 바 — 전부 완료 (4/4). */
export const ProgressFull: Story = {
  args: { progress: { done: 4, total: 4 } },
}

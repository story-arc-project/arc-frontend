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

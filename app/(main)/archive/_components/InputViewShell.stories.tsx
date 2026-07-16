import type { Meta, StoryObj } from "@storybook/nextjs"
import { useRef } from "react"

import InputViewShell from "./InputViewShell"
import type { ExperienceFormV2Handle } from "@/components/features/archive/ExperienceFormV2"

const meta: Meta<typeof InputViewShell> = {
  title: "Features/Archive/InputViewShell",
  component: InputViewShell,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta

type Story = StoryObj<typeof InputViewShell>

const DEMO_SECTIONS: { id: string; label: string }[] = [
  { id: "basic", label: "기본 정보" },
  { id: "detail", label: "경험 상세" },
  { id: "repeat", label: "반복 기록" },
  { id: "evidence", label: "활동 증빙" },
]

function Demo({ hasUnsaved }: { hasUnsaved: boolean }) {
  const formRef = useRef<ExperienceFormV2Handle | null>(null)
  return (
    <InputViewShell formRef={formRef} hasUnsaved={hasUnsaved} backTo="/archive" sections={DEMO_SECTIONS}>
      <div className="max-w-[640px] mx-auto px-5 py-10">
        <p className="text-body text-text-secondary">
          입력 폼 영역 — 실제로는 ExperienceFormV2 가 이 자리에 렌더된다.
        </p>
      </div>
    </InputViewShell>
  )
}

/** 미저장 변경 없음 — "목록으로" 클릭 시 가드 없이 바로 이동한다. */
export const Clean: Story = {
  render: () => <Demo hasUnsaved={false} />,
}

/** 미저장 변경 있음 — "목록으로" 클릭 시 이탈 가드 모달이 뜬다. */
export const Dirty: Story = {
  render: () => <Demo hasUnsaved />,
}

import type { Meta, StoryObj } from "@storybook/nextjs"
import { useState } from "react"

import RoleChips from "./RoleChips"
import { RoleHistoryProvider } from "@/contexts/RoleHistoryContext"

const ROLES = ["일반 부원", "공연팀장", "회장"]

/** 역할 목록을 공급하는 provider 안에서 controlled 로 동작시킨다. */
function Demo({ roles, initial }: { roles: string[]; initial: string[] }) {
  const [value, setValue] = useState(initial)
  return (
    <RoleHistoryProvider value={{ roles, renameRole: () => {}, removeRole: () => {} }}>
      <div className="flex items-start gap-2">
        <span className="font-bold leading-6 text-brand">•</span>
        <RoleChips inline value={value} onChange={setValue} />
        <span className="text-body text-text-primary">2024 봄 정기 공연</span>
      </div>
    </RoleHistoryProvider>
  )
}

const meta: Meta<typeof RoleChips> = {
  title: "Features/Archive/Blocks/RoleChips",
  component: RoleChips,
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof RoleChips>

export const Empty: Story = {
  render: () => <Demo roles={ROLES} initial={[]} />,
}

export const Selected: Story = {
  render: () => <Demo roles={ROLES} initial={["공연팀장"]} />,
}

/** 역할 이력이 비어 있으면 드롭다운이 먼저 등록하라고 안내한다. */
export const NoRolesRegistered: Story = {
  render: () => <Demo roles={[]} initial={[]} />,
}

/**
 * 등록 목록에서 사라진 값(구 데이터·손상값)은 회색으로 구분해 남긴다 —
 * 숨기면 선택돼 있는데 해제할 방법이 사라진다.
 */
export const OrphanTag: Story = {
  render: () => <Demo roles={["회장"]} initial={["회장", "옛 역할"]} />,
}

export const ReadOnly: Story = {
  args: { readOnly: true, value: ["공연팀장", "회장"], onChange: () => {} },
}

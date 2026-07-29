import type { Meta, StoryObj } from "@storybook/nextjs"
import { useState } from "react"

import RoleHistoryBlock from "./RoleHistoryBlock"
import { createRoleHistory } from "@/lib/utils/block-utils"
import { RoleHistoryProvider } from "@/contexts/RoleHistoryContext"
import type { Block, RepeatableCellBlockValue } from "@/types/archive"

const base = createRoleHistory("역할 이력", {
  guide: "시간에 따라 역할이 어떻게 변화했는지 시기별로 기록해주세요. 성장 서사를 보여주기 좋아요.",
})

function withRows(rows: { start: string; end: string; role: string }[]): Block {
  const value = base.value as RepeatableCellBlockValue
  return {
    ...base,
    value: {
      ...value,
      rows: rows.map((r, i) => ({ id: `row-${i}`, cells: { ...r } })),
    },
  }
}

function Demo({ initial }: { initial: Block }) {
  const [block, setBlock] = useState(initial)
  return (
    <RoleHistoryProvider value={{ roles: [], renameRole: () => {}, removeRole: () => {} }}>
      <RoleHistoryBlock block={block} onChange={v => setBlock(prev => ({ ...prev, value: v }))} />
    </RoleHistoryProvider>
  )
}

const meta: Meta<typeof RoleHistoryBlock> = {
  title: "Features/Archive/Blocks/RoleHistoryBlock",
  component: RoleHistoryBlock,
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof RoleHistoryBlock>

/** 기록이 없으면 접힌 버튼 하나로만 보인다(입력 허들 최소화). */
export const Collapsed: Story = {
  render: () => <Demo initial={base} />,
}

/** 이미 기록이 있으면 펼친 채로 시작한다 — 접으면 입력한 값이 사라져 보인다. */
export const WithHistory: Story = {
  render: () => (
    <Demo
      initial={withRows([
        { start: "2023-03", end: "2023-12", role: "일반 부원" },
        { start: "2024-03", end: "2024-12", role: "공연팀장" },
      ])}
    />
  ),
}

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    block: withRows([
      { start: "2023-03", end: "2023-12", role: "일반 부원" },
      { start: "2024-03", end: "", role: "회장" },
    ]),
    onChange: () => {},
  },
}

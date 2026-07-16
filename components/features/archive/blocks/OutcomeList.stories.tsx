import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"
import { useState } from "react"

import OutcomeList from "./OutcomeList"
import type { Block, RepeatableCellBlockValue } from "@/types/archive"

const meta: Meta<typeof OutcomeList> = {
  title: "Features/Archive/Blocks/OutcomeList",
  component: OutcomeList,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof OutcomeList>

function makeBlock(items: string[]): Block {
  return {
    id: "outcome-team",
    type: "repeatable-cell",
    label: "단체 활동 / 성과",
    variant: "outcome-list",
    guide: "팀·학회가 함께 이뤄낸 것들을 떠올려보세요. 수상, 발간, 대회 참가 등 무엇이든 괜찮아요.",
    value: {
      type: "repeatable-cell",
      columns: [
        { key: "item", label: "활동 / 성과", blockType: "text", placeholder: "예: 전국 케이스 경진대회 은상 수상" },
      ],
      rows: items.map((t, i) => ({ id: `row-${i}`, cells: { item: t } })),
    },
  }
}

/** 부모가 값을 소유하는 실제 사용을 재현(상호작용이 누적되도록). */
function Interactive({ initial, readOnly }: { initial: string[]; readOnly?: boolean }) {
  const [block, setBlock] = useState<Block>(() => makeBlock(initial))
  return (
    <OutcomeList
      block={block}
      readOnly={readOnly}
      onChange={(v: RepeatableCellBlockValue) => setBlock((b) => ({ ...b, value: v }))}
    />
  )
}

/** 빈 상태 — '+ 활동 / 성과 추가' 버튼만 보인다. */
export const Empty: Story = {
  render: () => <Interactive initial={[]} />,
}

/** 값이 있는 상태 — 각 행이 `• 텍스트 + ×`. */
export const WithItems: Story = {
  render: () => <Interactive initial={["전국 케이스 경진대회 은상 수상", "학회 저널 2호 공동 발간"]} />,
}

/** 상세뷰(readOnly) — 개조식 불릿 목록으로 렌더. */
export const ReadOnly: Story = {
  render: () => <Interactive initial={["전국 케이스 경진대회 은상 수상", "학회 저널 2호 공동 발간"]} readOnly />,
}

/** 추가 → 타이핑 → Enter로 다음 행 → 삭제 인터랙션. */
export const AddTypeAndDelete: Story = {
  render: () => <Interactive initial={[""]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // '+ 추가'로 두 번째 행 확보
    await userEvent.click(canvas.getByRole("button", { name: /추가/ }))
    let inputs = canvas.getAllByRole("textbox")
    expect(inputs).toHaveLength(2)

    // 첫 행에 입력 후 Enter → 세 번째 행 추가
    await userEvent.type(inputs[0], "케이스 대회 은상")
    await userEvent.keyboard("{Enter}")
    inputs = canvas.getAllByRole("textbox")
    expect(inputs).toHaveLength(3)
    expect((inputs[0] as HTMLInputElement).value).toBe("케이스 대회 은상")

    // 첫 행 삭제 → 두 행만 남음
    await userEvent.click(canvas.getByRole("button", { name: /케이스 대회 은상 삭제/ }))
    expect(canvas.getAllByRole("textbox")).toHaveLength(2)
  },
}

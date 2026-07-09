import type { Meta, StoryObj } from "@storybook/nextjs"

import RepeatableCellBlock from "./RepeatableCellBlock"
import type { Block } from "@/types/archive"

const meta: Meta<typeof RepeatableCellBlock> = {
  title: "Features/Archive/Blocks/RepeatableCellBlock",
  component: RepeatableCellBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof RepeatableCellBlock>

/** 단일 컬럼 목록(한 줄씩 추가) — 학회 '성장 / 변화' 같은 목록형 필드. */
const listBlock: Block = {
  id: "rc-list",
  type: "repeatable-cell",
  label: "성장 / 변화",
  guide: "이 경험을 통해 개선되거나 나아진 부분이 있나요? 역량이든, 사고방식이든, 습관이든 구체적일수록 좋아요",
  value: {
    type: "repeatable-cell",
    columns: [
      {
        key: "item",
        label: "항목",
        blockType: "text",
        placeholder: "예: 문제를 프레임으로 나눠 구조화하는 습관이 생겼습니다",
      },
    ],
    rows: [],
  },
}

/** guide 가 있으면 라벨과 행 사이에 회색 안내문이 렌더된다 (FRT-90). */
export const WithGuide: Story = {
  args: {
    block: listBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: {
      ...listBlock,
      value: {
        type: "repeatable-cell",
        columns: [{ key: "item", label: "항목", blockType: "text" }],
        rows: [
          { id: "r1", cells: { item: "문제를 프레임으로 나눠 구조화하는 습관이 생겼습니다" } },
          { id: "r2", cells: { item: "발표 피드백으로 논리 전달 방식을 개선했습니다" } },
        ],
      },
    },
    readOnly: true,
  },
}

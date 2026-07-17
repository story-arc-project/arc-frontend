import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, within } from "storybook/test"

import type { Block } from "@/types/archive"
import RepeatableCellBlock from "./RepeatableCellBlock"

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

/** 다중 컬럼 표 — 학회 '프로젝트/연구활동' 같은 기본 템플릿 표. */
const tableBlock: Block = {
  id: "rc-table",
  type: "repeatable-cell",
  label: "프로젝트/연구활동",
  value: {
    type: "repeatable-cell",
    columns: [
      { key: "name", label: "이름", blockType: "text" },
      { key: "role", label: "역할", blockType: "text" },
    ],
    rows: [{ id: "r1", cells: { name: "학회 세미나 운영", role: "기획" } }],
  },
}

/**
 * 컬럼 고정(FRT-104) — 기본 템플릿의 표. 열 태그·'열 추가'가 사라지고 정해진 컬럼만 입력한다.
 * 컬럼명은 각 행의 라벨로 남고, '행 추가'는 그대로 동작한다.
 */
export const LockedColumns: Story = {
  args: {
    block: { ...tableBlock, lockColumns: true },
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 열 관리 UI 는 없다
    expect(canvas.queryByPlaceholderText("열 추가...")).toBeNull()
    expect(canvas.queryByRole("button", { name: "이름 열 삭제" })).toBeNull()
    // 입력 맥락(컬럼명)과 행 추가는 남는다
    expect(canvas.getByText("이름")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: /행 추가/ })).toBeInTheDocument()
  },
}

/** 사용자가 직접 만든 커스텀 표 — 잠기지 않아 열 태그·'열 추가'로 컬럼을 관리한다(기존 동작). */
export const UnlockedColumns: Story = {
  args: {
    block: tableBlock,
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByPlaceholderText("열 추가...")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "이름 열 삭제" })).toBeInTheDocument()
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

import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"
import { useState } from "react"

import type { Block, RepeatableCellBlockValue } from "@/types/archive"
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

/** 부모가 값을 소유하는 실제 사용을 재현(입력이 누적되도록). */
function Interactive({ initial }: { initial: Block }) {
  const [block, setBlock] = useState<Block>(initial)
  return (
    <RepeatableCellBlock
      block={block}
      onChange={(v: RepeatableCellBlockValue) => setBlock((b) => ({ ...b, value: v }))}
    />
  )
}

/** 빈 표에 tags 컬럼까지 둔 블록 — 비텍스트 셀의 첫 입력 실체화를 덮는다. */
const emptyTableBlock: Block = {
  id: "rc-empty",
  type: "repeatable-cell",
  label: "프로젝트/연구활동",
  lockColumns: true,
  value: {
    type: "repeatable-cell",
    columns: [
      { key: "name", label: "이름", blockType: "text", placeholder: "예: 소비자 행동 리서치" },
      { key: "stack", label: "사용 도구", blockType: "tags", placeholder: "입력 후 Enter" },
    ],
    rows: [],
  },
}

/**
 * FRT-103 — 빈 상태에서도 입력 카드 한 장이 미리 보인다(입력 유도).
 * 이 카드는 value(rows)에 커밋되지 않아 손대지 않고 저장하면 블록은 빈 것으로 남는다.
 */
export const EmptyStatePlaceholder: Story = {
  render: () => <Interactive initial={emptyTableBlock} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 빈 상태: 입력칸은 보이지만 아직 데이터가 아니므로 '0개 항목'이고 삭제·행 추가는 없다.
    const nameInput = canvas.getByPlaceholderText("예: 소비자 행동 리서치")
    expect(nameInput).toBeInTheDocument()
    expect(canvas.getByText("0개 항목")).toBeInTheDocument()
    expect(canvas.queryByRole("button", { name: "행 삭제" })).toBeNull()
    expect(canvas.queryByRole("button", { name: /행 추가/ })).toBeNull()

    // 첫 입력으로 실체화 → 삭제·행 추가가 나타나고 항목 수가 1이 된다.
    await userEvent.type(nameInput, "소비자 행동 리서치")
    expect(canvas.getByText("1개 항목")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "행 삭제" })).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: /행 추가/ })).toBeInTheDocument()
    // 리마운트 없이 같은 인풋을 계속 쓴다(포커스·한글 IME 조합 보존).
    expect(canvas.getByPlaceholderText("예: 소비자 행동 리서치")).toBe(nameInput)
  },
}

/** tags 컬럼에서 첫 태그를 확정해도 실체화된다(텍스트 셀이 아닌 경로). */
export const PlaceholderMaterializesFromTags: Story = {
  render: () => <Interactive initial={emptyTableBlock} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("0개 항목")).toBeInTheDocument()
    await userEvent.type(canvas.getByPlaceholderText("입력 후 Enter"), "Python{enter}")
    expect(canvas.getByText("1개 항목")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "Python 삭제" })).toBeInTheDocument()
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

/**
 * FRT-122: 채운 행과 빈 행이 섞여도 상세뷰에는 채운 행만 보인다. 빈 행이 '#2 — —' 유령 행으로
 * 남지 않는지 가드한다 (행 하나 채우고 '행 추가'만 한 뒤 저장한 시나리오).
 */
export const ReadOnlyHidesBlankRows: Story = {
  args: {
    block: {
      ...listBlock,
      value: {
        type: "repeatable-cell",
        columns: [
          { key: "name", label: "활동", blockType: "text" },
          { key: "role", label: "역할", blockType: "text" },
        ],
        rows: [
          { id: "r1", cells: { name: "학회 세미나 운영", role: "기획" } },
          { id: "r2", cells: { name: "", role: "" } },
        ],
      },
    },
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 채운 행 #1 은 보이고, 빈 행 #2 는 렌더되지 않는다.
    await expect(canvas.getByText("#1")).toBeInTheDocument()
    await expect(canvas.queryByText("#2")).not.toBeInTheDocument()
    await expect(canvas.getByText("학회 세미나 운영")).toBeInTheDocument()
  },
}

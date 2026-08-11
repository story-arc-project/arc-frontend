import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import BlockList from "./BlockList"
import { createChecklistField, createSelectField } from "@/lib/utils/block-utils"
import type { Block, ChecklistBlockValue, SingleSelectBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

/**
 * 부모가 blocks 를 소유하는 실제 사용을 재현한다(편집 결과가 다시 렌더에 반영되도록).
 * 연필(블록 편집)은 `allowDelete && allowEdit` 일 때만 붙는다 — 사용자가 직접 추가한
 * 블록을 다루는 사용자 섹션의 설정이다.
 */
function Harness({ initial, onBlocks }: { initial: Block[]; onBlocks: (b: Block[]) => void }) {
  const [blocks, setBlocks] = useState(initial)
  return (
    <BlockList
      blocks={blocks}
      allowAdd
      allowDelete
      onChange={next => {
        setBlocks(next)
        onBlocks(next)
      }}
    />
  )
}

async function openBlockEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "블록 편집" }))
}

async function clickRemoveWhileEnabled(user: ReturnType<typeof userEvent.setup>, max: number) {
  for (let i = 0; i < max; i += 1) {
    const buttons = screen
      .queryAllByRole("button", { name: "옵션 삭제" })
      .filter(b => !(b as HTMLButtonElement).disabled)
    if (buttons.length === 0) break
    await user.click(buttons[0])
  }
}

describe("BlockList 블록 편집 모달", () => {
  it("체크리스트 옵션을 모달에서 전부 지우면 빈 목록이 블록에 반영된다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createChecklistField("참여 형태", ["온라인", "오프라인"])
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await clickRemoveWhileEnabled(user, 2)
    await user.click(screen.getByRole("button", { name: "확인" }))

    // 빈 배열을 truthy 로 읽으면 갱신을 건너뛰어 지운 옵션이 그대로 남는다(FRT-158 형제 결함).
    expect((latest[0].value as ChecklistBlockValue).options).toEqual([])
  })

  it("단일선택 옵션을 모달에서 지우면 남은 목록이 블록에 반영된다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createSelectField("고용 형태", ["정규직", "계약직"])
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await clickRemoveWhileEnabled(user, 2)
    await user.click(screen.getByRole("button", { name: "확인" }))

    // 단일선택은 마지막 하나가 잠기므로 0개가 되지 않는다.
    expect((latest[0].value as SingleSelectBlockValue).options).toEqual(["계약직"])
  })
})

describe("BlockList 모달에서 옵션을 지우면 그 옵션을 가리키던 선택값도 거둔다", () => {
  it("체크리스트: 지운 옵션이 checked 에 유령으로 남지 않는다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createChecklistField("참여 형태", ["온라인", "오프라인"])
    block.value = { type: "checklist", options: ["온라인", "오프라인"], checked: ["온라인"] }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await clickRemoveWhileEnabled(user, 2)
    await user.click(screen.getByRole("button", { name: "확인" }))

    // 남으면 상세뷰가 지운 라벨을 칩으로 계속 그리고(ChecklistBlock readOnly 는 checked 만 본다)
    // `isBlockEmpty` 도 checked 만 보므로 그 블록이 "채워짐"으로 굳는다.
    expect((latest[0].value as ChecklistBlockValue).checked).toEqual([])
  })

  it("단일선택: 지운 옵션이 selected 로 남지 않는다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createSelectField("고용 형태", ["정규직", "계약직"])
    block.value = { type: "single-select", options: ["정규직", "계약직"], selected: "정규직" }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await clickRemoveWhileEnabled(user, 1) // 첫 옵션(선택된 '정규직')만 지운다
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as SingleSelectBlockValue).selected).toBe("")
  })

  it("옵션에 애초에 없던 값은 옵션을 건드리지 않은 편집에서 지워지지 않는다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createChecklistField("참여 형태", ["온라인"])
    // 프리셋 개편 등으로 옵션에서 사라졌지만 checked 에는 남은 값 — MoodTagBlock 이 일부러
    // 보존하는 그 값이다. '제출된 목록 전체'로 대조하면 라벨만 고친 편집에 조용히 증발한다.
    block.value = { type: "checklist", options: ["온라인"], checked: ["온라인", "오프라인(구)"] }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.clear(screen.getByPlaceholderText("블록 이름을 입력하세요"))
    await user.type(screen.getByPlaceholderText("블록 이름을 입력하세요"), "참여 방식")
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as ChecklistBlockValue).checked).toEqual(["온라인", "오프라인(구)"])
  })
})

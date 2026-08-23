import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import BlockList from "./BlockList"
import {
  createChecklistField,
  createRepeatableCell,
  createSelectField,
  createTableField,
  isBlockEmpty,
} from "@/lib/utils/block-utils"
import type {
  Block,
  ChecklistBlockValue,
  RepeatableCellBlockValue,
  SingleSelectBlockValue,
  TableBlockValue,
} from "@/types/archive"

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

/**
 * **읽기 전용 보장은 입력 칸에서 끝나지 않는다 (FRT-200).**
 *
 * `BlockRenderer` 는 모르는 값 위에 편집 칸을 안 띄우지만, 그 칸을 감싼 **연필은 바깥에 있다.**
 * 눌리면 `getEditConfig` 가 `block.value.options` 를 무검증으로 꺼내 모달에 넘기고,
 * 모달은 그걸 `.join()`·`.map()` 한다 — 손상값 하나가 화면을 통째로 날린다.
 */
describe("모르는 값 위에는 편집 경로 전체를 닫는다", () => {
  function withValue(value: unknown): Block {
    const block = createChecklistField("참여 방식", ["온라인"])
    block.value = value as Block["value"]
    return block
  }

  it("성한 블록에는 연필이 붙는다 — 아래 두 단언이 빈 그물이 아님을 세우는 대조군", () => {
    render(<Harness initial={[withValue({ type: "checklist", options: ["온라인"], checked: [] })]} onBlocks={() => {}} />)
    expect(screen.queryByRole("button", { name: "블록 편집" })).not.toBeNull()
  })

  it("모르는 판별자를 담은 블록에는 연필이 붙지 않는다", () => {
    // 열면 `.join()` 에서 죽고, 살아서 확인을 누르면 보존해 둔 값을 덮는다 — 둘 다 막는다.
    render(<Harness initial={[withValue({ type: "rating-v3", options: {} })]} onBlocks={() => {}} />)
    expect(screen.queryByRole("button", { name: "블록 편집" })).toBeNull()
  })

  it("아는 타입인데 선택지가 깨져 있으면 연필을 열어도 죽지 않는다", async () => {
    const user = userEvent.setup()
    // 연필이 닫히는 건 판별자가 미지일 때뿐이다 — 아는 타입의 깨진 선택지는 열려야 하고,
    // 그때 모달에 배열 아닌 값이 넘어가면 렌더 도중 throw 한다.
    render(
      <Harness
        initial={[withValue({ type: "checklist", options: {}, checked: [] })]}
        onBlocks={() => {}}
      />,
    )
    await openBlockEditor(user)
    expect(screen.getByPlaceholderText("블록 이름을 입력하세요")).toBeTruthy()
  })
})

/**
 * **열 목록도 옵션 목록과 같은 규칙을 따라야 한다 (FRT-158 형제 결함).**
 *
 * `options` 는 "빈 배열도 그대로 넘긴다"로 이미 고쳐졌지만 `columns`/`tableColumns` 는
 * `length > 0 ? … : undefined` 로 접혀 있었다. `BlockList` 는 `undefined` 를
 * **"안 건드렸다"** 로 읽으므로, 사용자가 열을 전부 지우고 확인해도 갱신이 통째로 스킵되고
 * 옛 열이 그대로 남는다 — 지운 행위가 조용히 삼켜진다.
 */
describe("BlockList 모달에서 열을 전부 지우면 빈 목록이 반영된다", () => {
  it("표: 열을 전부 지우면 빈 열 목록이 블록에 반영된다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createTableField("기록표")
    block.value = { type: "table", columns: ["열1"], rows: [["v"]] }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getByRole("button", { name: "열1 삭제" }))
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as TableBlockValue).columns).toEqual([])
  })

  it("반복 셀: 열을 전부 지우면 빈 열 목록이 블록에 반영된다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createRepeatableCell(
      "활동 로그",
      [{ key: "c1", label: "날짜", blockType: "date" }],
      { lockColumns: false },
    )
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getByRole("button", { name: "열 삭제" }))
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as RepeatableCellBlockValue).columns).toEqual([])
  })

  it("열을 하나만 지우면 남은 열이 그대로 반영된다 — 위 두 단언이 빈 그물이 아님을 세우는 대조군", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createTableField("기록표")
    block.value = { type: "table", columns: ["열1", "열2"], rows: [] }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getByRole("button", { name: "열1 삭제" }))
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as TableBlockValue).columns).toEqual(["열2"])
  })
})

/**
 * **열을 지우면 그 열이 담고 있던 값도 함께 사라져야 한다 (Codex 리뷰 P2 2건).**
 *
 * 열 목록만 갈아끼우면 지운 열의 값이 `rows` 에 유령으로 남는다. 그 잔재는 눈에 안 보이는
 * 데서 판정을 뒤집는다 — `isBlockEmpty` 가 반복 셀은 `rowHasContent`(=셀에 값이 있는가),
 * 표는 `rows.length` 로 판정하므로, **화면엔 아무 칸도 없는 블록이 "내용 있음"으로 굳어**
 * 상세뷰에 빈 껍데기로 계속 그려지고 열을 다시 만들면 옛 값·빈 행이 되살아난다.
 */
describe("모달에서 열을 지우면 그 열의 값도 함께 거둔다", () => {
  it("반복 셀: 열을 전부 지우면 그 열의 셀도 사라져 빈 블록이 된다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createRepeatableCell(
      "활동 로그",
      [{ key: "c1", label: "날짜", blockType: "date" }],
      { lockColumns: false },
    )
    block.value = {
      type: "repeatable-cell",
      columns: [{ key: "c1", label: "날짜", blockType: "date" }],
      rows: [{ id: "r1", cells: { c1: "2026-01-01" } }],
    }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getByRole("button", { name: "열 삭제" }))
    await user.click(screen.getByRole("button", { name: "확인" }))

    const val = latest[0].value as RepeatableCellBlockValue
    expect(val.rows[0].cells).toEqual({})
    expect(isBlockEmpty(latest[0])).toBe(true)
  })

  it("반복 셀: 열을 하나만 지우면 남은 열의 값은 그대로다 — 값을 통째로 날리지 않는다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const columns = [
      { key: "c1", label: "날짜", blockType: "date" as const },
      { key: "c2", label: "메모", blockType: "text" as const },
    ]
    const block = createRepeatableCell("활동 로그", columns, { lockColumns: false })
    block.value = {
      type: "repeatable-cell",
      columns,
      rows: [{ id: "r1", cells: { c1: "2026-01-01", c2: "메모값" } }],
    }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getAllByRole("button", { name: "열 삭제" })[0])
    await user.click(screen.getByRole("button", { name: "확인" }))

    const val = latest[0].value as RepeatableCellBlockValue
    expect(val.rows[0].cells).toEqual({ c2: "메모값" })
    expect(isBlockEmpty(latest[0])).toBe(false)
  })

  it("표: 열을 전부 지우면 껍데기 행도 남지 않는다", async () => {
    const user = userEvent.setup()
    let latest: Block[] = []
    const block = createTableField("기록표")
    block.value = { type: "table", columns: ["열1"], rows: [["v"]] }
    render(<Harness initial={[block]} onBlocks={b => { latest = b }} />)

    await openBlockEditor(user)
    await user.click(screen.getByRole("button", { name: "열1 삭제" }))
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect((latest[0].value as TableBlockValue).rows).toEqual([])
    expect(isBlockEmpty(latest[0])).toBe(true)
  })
})

/**
 * **모달은 단일 인스턴스라 앞 블록의 열 구성이 남을 여지가 있다 (FRT-272).**
 *
 * 내부 상태를 리셋하는 키에 `columns`/`tableColumns` 가 빠져 있어, 라벨이 같은 표 블록을
 * 연달아 열면 키가 같아진다. 지금 이게 사고로 번지지 않는 이유는 **닫힘(open=false) 렌더가
 * 반드시 한 번 끼어들어 키를 비우기 때문**이다 — 즉 안전은 리셋 키가 아니라 *닫힘을 거친다*는
 * 사실이 떠받치고 있다. 모달을 닫지 않고 다른 블록으로 갈아타는 UI 가 생기면 그날로 깨진다.
 * 이 테스트는 그 사실을 못 박는다.
 */
describe("라벨이 같은 블록을 연달아 열어도 앞 블록의 열 구성이 남지 않는다", () => {
  function tableWithColumns(id: string, label: string, columns: string[]): Block {
    const block = createTableField(label)
    block.id = id
    block.value = { type: "table", columns, rows: [] }
    return block
  }

  it("A 에서 열을 바꾸고 닫은 뒤 B 를 열면 B 의 실제 열만 보인다", async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={[
          tableWithColumns("a", "기록표", ["A열1", "A열2"]),
          tableWithColumns("b", "기록표", ["B열1"]),
        ]}
        onBlocks={() => {}}
      />,
    )

    await user.click(screen.getAllByRole("button", { name: "블록 편집" })[0])
    await user.type(screen.getByPlaceholderText("열 이름 추가..."), "A열3{Enter}")
    await user.click(screen.getByRole("button", { name: "취소" }))

    await user.click(screen.getAllByRole("button", { name: "블록 편집" })[1])

    expect(screen.queryByRole("button", { name: "B열1 삭제" })).not.toBeNull()
    expect(screen.queryByRole("button", { name: "A열1 삭제" })).toBeNull()
    expect(screen.queryByRole("button", { name: "A열3 삭제" })).toBeNull()
  })
})

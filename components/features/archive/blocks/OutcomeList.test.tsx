import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import OutcomeList from "./OutcomeList"
import { ProjectLinkProvider, type ProjectLinkContextValue } from "@/contexts/ProjectLinkContext"
import type { Block, RepeatableCellBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function makeBlock(items: string[] = []): Block {
  return {
    id: "b1",
    type: "repeatable-cell",
    label: "단체 활동 / 성과",
    variant: "outcome-list",
    value: {
      type: "repeatable-cell",
      columns: [{ key: "item", label: "활동 / 성과", blockType: "text", placeholder: "예: 수상" }],
      rows: items.map((t, i) => ({ id: `row-${i}`, cells: { item: t } })),
    },
  }
}

/** 부모가 값을 소유하는 controlled 사용을 재현한다(상호작용이 누적되도록). */
function Harness({
  initial,
  readOnly,
  onValue,
}: {
  initial: string[]
  readOnly?: boolean
  onValue?: (v: RepeatableCellBlockValue) => void
}) {
  const [block, setBlock] = useState<Block>(() => makeBlock(initial))
  return (
    <OutcomeList
      block={block}
      readOnly={readOnly}
      onChange={(v) => {
        onValue?.(v)
        setBlock((b) => ({ ...b, value: v }))
      }}
    />
  )
}

function textInputs(): HTMLTextAreaElement[] {
  return screen.getAllByRole("textbox") as HTMLTextAreaElement[]
}

describe("OutcomeList", () => {
  it("각 행의 값을 인풋에 렌더한다", () => {
    render(<Harness initial={["케이스 대회 은상", "논문 발간"]} />)
    const inputs = textInputs()
    expect(inputs.map((i) => i.value)).toEqual(["케이스 대회 은상", "논문 발간"])
  })

  it("컬럼 placeholder 를 각 행 인풋에 주입한다", () => {
    render(<Harness initial={[""]} />)
    expect(screen.getByPlaceholderText("예: 수상")).toBeInTheDocument()
  })

  it("'+ 추가' 버튼을 누르면 행이 하나 늘어난다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A"]} />)
    await user.click(screen.getByRole("button", { name: /추가/ }))
    expect(textInputs()).toHaveLength(2)
  })

  it("인풋에서 Enter 를 누르면 아래에 새 행이 추가된다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A"]} />)
    await user.click(textInputs()[0])
    await user.keyboard("{Enter}")
    expect(textInputs()).toHaveLength(2)
  })

  it("Shift+Enter 는 새 행을 추가하지 않는다(한 행 내 줄바꿈 허용)", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A"]} />)
    await user.click(textInputs()[0])
    await user.keyboard("{Shift>}{Enter}{/Shift}")
    expect(textInputs()).toHaveLength(1)
  })

  it("빈 행에서 Backspace 를 누르면(행 2개 이상) 그 행이 삭제된다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A", ""]} />)
    const second = textInputs()[1]
    await user.click(second)
    await user.keyboard("{Backspace}")
    const inputs = textInputs()
    expect(inputs).toHaveLength(1)
    expect(inputs[0].value).toBe("A")
  })

  it("삭제 버튼을 누르면 해당 행이 사라진다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A", "B"]} />)
    await user.click(screen.getByRole("button", { name: /A 삭제/ }))
    const inputs = textInputs()
    expect(inputs).toHaveLength(1)
    expect(inputs[0].value).toBe("B")
  })

  it("마지막 행을 삭제하면 rows 가 비고 인풋 없이 추가 버튼만 남는다(빈 블록 불변식)", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={["A"]} onValue={onValue} />)
    await user.click(screen.getByRole("button", { name: /삭제/ }))
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByRole("button", { name: /추가/ })).toBeInTheDocument()
    const last = onValue.mock.calls.at(-1)![0] as RepeatableCellBlockValue
    expect(last.rows).toHaveLength(0)
  })

  it("삭제해도 나머지 행의 안정 id 가 보존된다(FRT-76 앵커)", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={["A", "B"]} onValue={onValue} />)
    await user.click(screen.getByRole("button", { name: /A 삭제/ }))
    const last = onValue.mock.calls.at(-1)![0] as RepeatableCellBlockValue
    expect(last.rows).toHaveLength(1)
    expect(last.rows[0].id).toBe("row-1")
    expect(last.rows[0].cells.item).toBe("B")
  })

  it("IME 조합 중 Enter 는 행을 추가하지 않는다(한글 입력)", () => {
    render(<Harness initial={["A"]} />)
    fireEvent.keyDown(textInputs()[0], { key: "Enter", isComposing: true })
    expect(textInputs()).toHaveLength(1)
  })

  it("readOnly 모드는 불릿 텍스트만 보여주고 인풋을 렌더하지 않는다", () => {
    render(<Harness initial={["A", "B"]} readOnly />)
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
  })

  it("rowAction 슬롯(FRT-76 seam)을 각 행에 렌더한다", () => {
    render(
      <OutcomeList
        block={makeBlock(["A", "B"])}
        onChange={() => {}}
        rowAction={(row) => <button type="button">기록-{row.id}</button>}
      />,
    )
    expect(screen.getByRole("button", { name: "기록-row-0" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "기록-row-1" })).toBeInTheDocument()
  })

  it("빈 행에서 값을 입력하면 해당 행 cells.item 으로 onChange 한다", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={[""]} onValue={onValue} />)
    await user.type(textInputs()[0], "수상")
    const last = onValue.mock.calls.at(-1)![0] as RepeatableCellBlockValue
    expect(last.rows[0].cells.item).toBe("수상")
  })
})

// ── FRT-76: '프로젝트로 연결' 링크 UI ────────────────────────────────
function makeLinkBlock(
  rows: { id: string; item: string; linkedProjectRowId?: string }[] = [],
): Block {
  return {
    id: "b1",
    type: "repeatable-cell",
    label: "단체 활동 / 성과",
    variant: "outcome-list",
    linkConfig: { targetSectionId: "society-projects", titleColumnKey: "name", label: "프로젝트로 연결" },
    value: {
      type: "repeatable-cell",
      columns: [{ key: "item", label: "활동 / 성과", blockType: "text" }],
      rows: rows.map((r) => ({
        id: r.id,
        cells: { item: r.item },
        ...(r.linkedProjectRowId ? { linkedProjectRowId: r.linkedProjectRowId } : {}),
      })),
    },
  }
}

function makeCtx(overrides?: Partial<ProjectLinkContextValue>): ProjectLinkContextValue {
  return {
    createProjectRow: vi.fn(() => "proj-1"),
    getProjectRow: vi.fn(() => ({ title: "케이스 대회 은상" })),
    scrollToProjectRow: vi.fn(),
    ...overrides,
  }
}

function LinkHarness({
  initial,
  ctx,
  onValue,
}: {
  initial: Block
  ctx: ProjectLinkContextValue | null
  onValue?: (v: RepeatableCellBlockValue) => void
}) {
  const [block, setBlock] = useState<Block>(() => initial)
  const node = (
    <OutcomeList
      block={block}
      onChange={(v) => {
        onValue?.(v)
        setBlock((b) => ({ ...b, value: v }))
      }}
    />
  )
  return ctx ? <ProjectLinkProvider value={ctx}>{node}</ProjectLinkProvider> : node
}

describe("OutcomeList — 프로젝트로 연결 (FRT-76)", () => {
  it("linkConfig + provider 가 있으면 각 행에 링크 버튼을 렌더한다", () => {
    render(<LinkHarness initial={makeLinkBlock([{ id: "r0", item: "케이스 대회 은상" }])} ctx={makeCtx()} />)
    expect(screen.getByRole("button", { name: "프로젝트로 연결" })).toBeInTheDocument()
  })

  it("provider 가 없으면(상세뷰·스토리북) 링크 버튼을 렌더하지 않는다", () => {
    render(<LinkHarness initial={makeLinkBlock([{ id: "r0", item: "A" }])} ctx={null} />)
    expect(screen.queryByRole("button", { name: "프로젝트로 연결" })).toBeNull()
  })

  it("linkConfig 가 없으면(opt-in 안 함) 링크 버튼이 없다", () => {
    render(
      <ProjectLinkProvider value={makeCtx()}>
        <OutcomeList block={makeBlock(["A"])} onChange={() => {}} />
      </ProjectLinkProvider>,
    )
    expect(screen.queryByRole("button", { name: "프로젝트로 연결" })).toBeNull()
  })

  it("링크 버튼 클릭 → createProjectRow 호출·행에 linkedProjectRowId 세팅·스크롤", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    const ctx = makeCtx()
    render(
      <LinkHarness initial={makeLinkBlock([{ id: "r0", item: "케이스 대회 은상" }])} ctx={ctx} onValue={onValue} />,
    )
    await user.click(screen.getByRole("button", { name: "프로젝트로 연결" }))
    expect(ctx.createProjectRow).toHaveBeenCalledWith("society-projects", "name", "케이스 대회 은상")
    const last = onValue.mock.calls.at(-1)![0] as RepeatableCellBlockValue
    expect(last.rows[0].linkedProjectRowId).toBe("proj-1")
    expect(ctx.scrollToProjectRow).toHaveBeenCalledWith("proj-1")
  })

  it("이미 연결된 행은 '연결됨' 칩을 보이고 링크 버튼을 숨긴다", () => {
    render(
      <LinkHarness
        initial={makeLinkBlock([{ id: "r0", item: "케이스 대회 은상", linkedProjectRowId: "proj-1" }])}
        ctx={makeCtx()}
      />,
    )
    expect(screen.getByRole("button", { name: /연결됨/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "프로젝트로 연결" })).toBeNull()
  })

  it("'연결됨' 클릭 시 해당 프로젝트로 스크롤한다", async () => {
    const user = userEvent.setup()
    const ctx = makeCtx()
    render(
      <LinkHarness
        initial={makeLinkBlock([{ id: "r0", item: "A", linkedProjectRowId: "proj-1" }])}
        ctx={ctx}
      />,
    )
    await user.click(screen.getByRole("button", { name: /연결됨/ }))
    expect(ctx.scrollToProjectRow).toHaveBeenCalledWith("proj-1")
  })

  it("연결 해제 시 linkedProjectRowId 를 제거한다(프로젝트 행은 존치)", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(
      <LinkHarness
        initial={makeLinkBlock([{ id: "r0", item: "A", linkedProjectRowId: "proj-1" }])}
        ctx={makeCtx()}
        onValue={onValue}
      />,
    )
    await user.click(screen.getByRole("button", { name: "프로젝트 연결 해제" }))
    const last = onValue.mock.calls.at(-1)![0] as RepeatableCellBlockValue
    expect(last.rows[0].linkedProjectRowId).toBeUndefined()
  })

  it("대상 프로젝트가 사라지면(stale) 링크 버튼으로 복귀한다", () => {
    render(
      <LinkHarness
        initial={makeLinkBlock([{ id: "r0", item: "A", linkedProjectRowId: "gone" }])}
        ctx={makeCtx({ getProjectRow: vi.fn(() => null) })}
      />,
    )
    expect(screen.queryByRole("button", { name: /연결됨/ })).toBeNull()
    expect(screen.getByRole("button", { name: "프로젝트로 연결" })).toBeInTheDocument()
  })
})

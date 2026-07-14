import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import OutcomeList from "./OutcomeList"
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

function textInputs(): HTMLInputElement[] {
  return screen.getAllByRole("textbox") as HTMLInputElement[]
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

  it("행이 하나뿐일 때 삭제하면 행은 유지하고 텍스트만 비운다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={["A"]} />)
    await user.click(screen.getByRole("button", { name: /삭제/ }))
    const inputs = textInputs()
    expect(inputs).toHaveLength(1)
    expect(inputs[0].value).toBe("")
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

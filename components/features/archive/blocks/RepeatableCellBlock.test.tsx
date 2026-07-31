import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import RepeatableCellBlock from "./RepeatableCellBlock"
import { isBlockEmpty } from "@/lib/utils/block-utils"
import type { Block, BlockRow, RepeatableCellBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function makeBlock(rows: BlockRow[], opts?: { allowRowExtras?: boolean }): Block {
  return {
    id: "b1",
    type: "repeatable-cell",
    label: "프로젝트 / 과제",
    lockColumns: true,
    ...(opts?.allowRowExtras ? { allowRowExtras: true } : {}),
    value: {
      type: "repeatable-cell",
      columns: [
        { key: "name", label: "프로젝트명", blockType: "text", required: true },
        { key: "desc", label: "간단한 설명", blockType: "textarea" },
      ],
      rows,
    },
  }
}

/** 부모가 값을 소유하는 controlled 사용을 재현한다(상호작용이 누적되도록). */
function Harness({
  block: initial,
  readOnly,
  onValue,
}: {
  block: Block
  readOnly?: boolean
  onValue?: (v: RepeatableCellBlockValue) => void
}) {
  const [block, setBlock] = useState<Block>(initial)
  return (
    <RepeatableCellBlock
      block={block}
      readOnly={readOnly}
      onChange={v => {
        onValue?.(v)
        setBlock(b => ({ ...b, value: v }))
      }}
    />
  )
}

/** '항목 추가' → 유형 선택 → 이름 입력 → 추가. */
async function addExtraField(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  type?: string,
) {
  await user.click(screen.getByRole("button", { name: "항목 추가" }))
  if (type) await user.selectOptions(screen.getByLabelText("항목 유형"), type)
  await user.type(screen.getByLabelText("추가할 항목 이름"), name)
  await user.click(screen.getByRole("button", { name: "추가" }))
}

describe("RepeatableCellBlock — 행에 나만의 항목 추가 (FRT-145)", () => {
  it("allowRowExtras 를 켜지 않은 블록에는 '항목 추가'가 없다", () => {
    render(<Harness block={makeBlock([{ id: "r1", cells: { name: "A" } }])} />)
    expect(screen.queryByRole("button", { name: "항목 추가" })).toBeNull()
  })

  it("이름이 비면 항목이 추가되지 않는다", async () => {
    const user = userEvent.setup()
    render(
      <Harness block={makeBlock([{ id: "r1", cells: { name: "A" } }], { allowRowExtras: true })} />,
    )

    await user.click(screen.getByRole("button", { name: "항목 추가" }))
    await user.click(screen.getByRole("button", { name: "추가" }))

    // 이름 입력칸이 그대로 남아있고 새 항목은 생기지 않는다.
    expect(screen.getByLabelText("추가할 항목 이름")).toBeDefined()
    expect(screen.queryByLabelText("항목 이름")).toBeNull()
  })

  it("추가한 항목의 이름·유형·값이 extraFields 로 저장된다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock([{ id: "r1", cells: { name: "A" } }], { allowRowExtras: true })}
        onValue={v => { latest = v }}
      />,
    )

    await addExtraField(user, "수상 내역")
    await user.type(screen.getByLabelText("수상 내역"), "우수상")

    const extras = latest?.rows[0].extraFields
    expect(extras).toHaveLength(1)
    expect(extras?.[0].label).toBe("수상 내역")
    expect(extras?.[0].blockType).toBe("text")
    expect(extras?.[0].value).toBe("우수상")
    // 열은 템플릿이 계속 소유한다 — 항목을 더해도 columns 는 그대로다(FRT-104 유지).
    expect(latest?.columns.map(c => c.key)).toEqual(["name", "desc"])
  })

  it("유형을 고르면 그 유형의 입력칸이 나온다", async () => {
    const user = userEvent.setup()
    render(
      <Harness block={makeBlock([{ id: "r1", cells: { name: "A" } }], { allowRowExtras: true })} />,
    )

    await addExtraField(user, "발표일", "date")

    expect(screen.getByLabelText("발표일").getAttribute("type")).toBe("date")
  })

  it("선택지 없이 성립하지 않는 유형(single-select·checklist)은 고를 수 없다", async () => {
    const user = userEvent.setup()
    render(
      <Harness block={makeBlock([{ id: "r1", cells: { name: "A" } }], { allowRowExtras: true })} />,
    )
    await user.click(screen.getByRole("button", { name: "항목 추가" }))

    const values = Array.from(
      screen.getByLabelText("항목 유형").querySelectorAll("option"),
    ).map(o => o.getAttribute("value"))
    expect(values).toEqual(["text", "textarea", "date", "link", "tags"])
  })

  it("항목 이름은 나중에 고칠 수 있다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock(
          [{ id: "r1", cells: { name: "A" }, extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "우수상" }] }],
          { allowRowExtras: true },
        )}
        onValue={v => { latest = v }}
      />,
    )

    const labelInput = screen.getByDisplayValue("수상")
    await user.type(labelInput, " 내역")

    expect(latest?.rows[0].extraFields?.[0].label).toBe("수상 내역")
    expect(latest?.rows[0].extraFields?.[0].value).toBe("우수상")
  })

  it("이름을 비운 채 떠나면 직전 이름으로 되돌아간다 — 값은 그대로다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock(
          [{ id: "r1", cells: { name: "A" }, extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "우수상" }] }],
          { allowRowExtras: true },
        )}
        onValue={v => { latest = v }}
      />,
    )

    const labelInput = screen.getByDisplayValue("수상")
    await user.clear(labelInput)
    // 타이핑 중 빈 칸을 거치는 건 막지 않는다.
    expect(latest?.rows[0].extraFields?.[0].label).toBe("")

    await user.tab()

    expect(latest?.rows[0].extraFields?.[0].label).toBe("수상")
    expect(latest?.rows[0].extraFields?.[0].value).toBe("우수상")
  })

  it("이름 앞뒤 공백은 떠날 때 정리된다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock(
          [{ id: "r1", cells: { name: "A" }, extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "" }] }],
          { allowRowExtras: true },
        )}
        onValue={v => { latest = v }}
      />,
    )

    await user.type(screen.getByDisplayValue("수상"), " 내역  ")
    await user.tab()

    expect(latest?.rows[0].extraFields?.[0].label).toBe("수상 내역")
  })

  it("값이 빈 항목은 확인 없이 삭제된다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock(
          [{ id: "r1", cells: { name: "A" }, extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "" }] }],
          { allowRowExtras: true },
        )}
        onValue={v => { latest = v }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "수상 항목 삭제" }))

    expect(latest?.rows[0].extraFields).toEqual([])
    expect(screen.queryByRole("button", { name: "지우기" })).toBeNull()
  })

  it("값이 있는 항목은 한 번 확인한 뒤에야 지워진다 — 취소하면 값이 남는다", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    const block = makeBlock(
      [{ id: "r1", cells: { name: "A" }, extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "우수상" }] }],
      { allowRowExtras: true },
    )
    render(<Harness block={block} onValue={v => { latest = v }} />)

    await user.click(screen.getByRole("button", { name: "수상 항목 삭제" }))
    expect(latest).toBeUndefined() // 아직 아무것도 지우지 않았다
    await user.click(screen.getByRole("button", { name: "취소" }))
    expect(screen.getByDisplayValue("우수상")).toBeDefined()

    await user.click(screen.getByRole("button", { name: "수상 항목 삭제" }))
    await user.click(screen.getByRole("button", { name: "지우기" }))
    expect(latest?.rows[0].extraFields).toEqual([])
  })

  it("셀을 수정해도 추가 항목이 보존된다 — 행 재구성 회귀 (FRT-178 교훈)", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness
        block={makeBlock(
          [{
            id: "r1",
            cells: { name: "A" },
            linkedProjectRowId: "other-row",
            extraFields: [{ key: "x1", label: "수상", blockType: "text", value: "우수상" }],
          }],
          { allowRowExtras: true },
        )}
        onValue={v => { latest = v }}
      />,
    )

    await user.type(screen.getByLabelText("프로젝트명"), "B")

    expect(latest?.rows[0].extraFields).toHaveLength(1)
    expect(latest?.rows[0].extraFields?.[0].value).toBe("우수상")
    expect(latest?.rows[0].linkedProjectRowId).toBe("other-row")
  })

  it("빈 블록의 표시용 행에서 항목을 추가하면 행이 실체화된다 (FRT-103 경로)", async () => {
    const user = userEvent.setup()
    let latest: RepeatableCellBlockValue | undefined
    render(
      <Harness block={makeBlock([], { allowRowExtras: true })} onValue={v => { latest = v }} />,
    )

    await addExtraField(user, "수상 내역")

    expect(latest?.rows).toHaveLength(1)
    expect(latest?.rows[0].extraFields?.[0].label).toBe("수상 내역")
    // 컬럼 셀은 건드리지 않는다.
    expect(latest?.rows[0].cells).toEqual({ name: "", desc: "" })
  })

  describe("조회 화면", () => {
    const rowWithOnlyExtra: BlockRow = {
      id: "r1",
      cells: { name: "", desc: "" },
      extraFields: [{ key: "x1", label: "수상 내역", blockType: "text", value: "우수상" }],
    }

    it("추가 항목에만 값이 있는 행도 조회 화면에 보인다 — 유령 행 필터가 값을 숨기지 않는다", () => {
      render(<Harness block={makeBlock([rowWithOnlyExtra], { allowRowExtras: true })} readOnly />)

      expect(screen.getByText("수상 내역")).toBeDefined()
      expect(screen.getByText("우수상")).toBeDefined()
    })

    it("isBlockEmpty 도 추가 항목만 채운 블록을 비었다고 하지 않는다", () => {
      expect(isBlockEmpty(makeBlock([rowWithOnlyExtra], { allowRowExtras: true }))).toBe(false)
      expect(isBlockEmpty(makeBlock([{ id: "r1", cells: { name: "" } }]))).toBe(true)
    })

    it("값이 빈 추가 항목은 조회 화면에서 감춘다", () => {
      render(
        <Harness
          block={makeBlock(
            [{
              id: "r1",
              cells: { name: "A" },
              extraFields: [
                { key: "x1", label: "채운 항목", blockType: "text", value: "값" },
                { key: "x2", label: "빈 항목", blockType: "text", value: "" },
              ],
            }],
            { allowRowExtras: true },
          )}
          readOnly
        />,
      )

      expect(screen.getByText("채운 항목")).toBeDefined()
      expect(screen.queryByText("빈 항목")).toBeNull()
    })
  })
})

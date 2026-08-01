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

  it("선택지 없이 성립하지 않는 유형(single-select·checklist)과 file 은 고를 수 없다", async () => {
    const user = userEvent.setup()
    render(
      <Harness block={makeBlock([{ id: "r1", cells: { name: "A" } }], { allowRowExtras: true })} />,
    )
    await user.click(screen.getByRole("button", { name: "항목 추가" }))

    const values = Array.from(
      screen.getByLabelText("항목 유형").querySelectorAll("option"),
    ).map(o => o.getAttribute("value"))
    // FRT-213: 'period' 가 열렸다. 'file' 은 값이 구조화 객체라 RowExtraField 에 담기지 않아 계속 빠진다.
    expect(values).toEqual(["text", "textarea", "date", "period", "link", "tags"])
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

// ─── FRT-213: 기간·파일 셀, 무음 폴백 제거 ──────────────────────

/** 임의의 컬럼 정의로 블록을 만든다(기간·파일·미지원 유형 검증용). */
function makeBlockWithColumns(
  columns: RepeatableCellBlockValue["columns"],
  rows: BlockRow[],
): Block {
  return {
    id: "b1",
    type: "repeatable-cell",
    label: "경험 상세 기록",
    value: { type: "repeatable-cell", columns, rows },
  }
}

describe("period 셀 (FRT-213)", () => {
  const columns = [{ key: "period", label: "기간", blockType: "period" as const }]

  it("텍스트칸이 아니라 월 입력 2개와 '현재' 체크박스가 나온다", () => {
    render(<Harness block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "" } }])} />)

    expect(screen.getByLabelText("기간 시작")).toHaveAttribute("type", "month")
    expect(screen.getByLabelText("기간 종료")).toHaveAttribute("type", "month")
    expect(screen.getByRole("checkbox", { name: "기간 현재" })).toBeInTheDocument()
  })

  // 기간 컬럼이 여러 개거나 행이 여럿이면 체크박스가 전부 '현재'로만 읽혀
  // 어느 기간을 바꾸는 건지 알 수 없다 — 시작·종료 입력만 컬럼 이름을 달고 있었다.
  it("'현재' 체크박스에도 컬럼 이름이 붙는다", () => {
    render(<Harness block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "" } }])} />)

    expect(screen.queryByRole("checkbox", { name: "현재" })).toBeNull()
    expect(screen.getByRole("checkbox", { name: "기간 현재" })).toBeInTheDocument()
  })

  it("시작만 고르면 점 구분 문자열 한 토큰으로 저장된다", async () => {
    const user = userEvent.setup()
    const seen: RepeatableCellBlockValue[] = []
    render(
      <Harness
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "" } }])}
        onValue={v => seen.push(v)}
      />,
    )

    await user.type(screen.getByLabelText("기간 시작"), "2023-03")

    expect(seen.at(-1)?.rows[0].cells.period).toBe("2023.03")
  })

  it("'현재'를 켜면 종료 입력이 잠기고 값이 '현재'로 직렬화된다", async () => {
    const user = userEvent.setup()
    const seen: RepeatableCellBlockValue[] = []
    render(
      <Harness
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "2023.03 ~ 2024.01" } }])}
        onValue={v => seen.push(v)}
      />,
    )

    await user.click(screen.getByRole("checkbox", { name: "기간 현재" }))

    expect(seen.at(-1)?.rows[0].cells.period).toBe("2023.03 ~ 현재")
    expect(screen.getByLabelText("기간 종료")).toBeDisabled()
  })

  it("저장된 점 문자열을 월 입력에 되돌려 읽는다 — 새로고침 후 값이 사라지지 않는다", () => {
    render(
      <Harness
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "2023.03 ~ 2024.01" } }])}
      />,
    )

    expect(screen.getByLabelText("기간 시작")).toHaveValue("2023-03")
    expect(screen.getByLabelText("기간 종료")).toHaveValue("2024-01")
  })

  it("조회 화면에는 저장된 문자열이 그대로 보인다", () => {
    render(
      <Harness
        readOnly
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: "2023.03 ~ 현재" } }])}
      />,
    )

    expect(screen.getByText("2023.03 ~ 현재")).toBeInTheDocument()
  })
})

describe("알 수 없는 컬럼 유형 (FRT-213)", () => {
  // 저장된 값의 columns 가 템플릿보다 우선 채택되므로, 타입에 없는 문자열이 런타임에 들어올 수 있다.
  const columns = [
    { key: "mystery", label: "미래 유형", blockType: "signature" as never },
  ] as RepeatableCellBlockValue["columns"]

  it("조용히 텍스트칸이 되지 않고 화면에 알린다", () => {
    render(<Harness block={makeBlockWithColumns(columns, [{ id: "r1", cells: { mystery: "값" } }])} />)

    expect(screen.getByText(/아직 지원하지 않는 입력 유형/)).toBeInTheDocument()
  })

  it("값은 그대로 보존하고 계속 편집할 수 있다", async () => {
    const user = userEvent.setup()
    const seen: RepeatableCellBlockValue[] = []
    render(
      <Harness
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { mystery: "기존 값" } }])}
        onValue={v => seen.push(v)}
      />,
    )

    const input = screen.getByLabelText("미래 유형")
    expect(input).toHaveValue("기존 값")

    await user.type(input, "!")
    expect(seen.at(-1)?.rows[0].cells.mystery).toBe("기존 값!")
  })

  // 조회 화면은 편집칸을 안 거치므로 경고 분기도 함께 비껴간다 — 보는 사람은 잘려 보이는 값을
  // 온전한 표시로 오해한다. 무음 폴백을 없애는 게 이 작업이니 조회 쪽도 같이 알려야 한다.
  it("조회 화면에서도 알 수 없는 유형임을 알린다", () => {
    render(<Harness readOnly block={makeBlockWithColumns(columns, [{ id: "r1", cells: { mystery: "값" } }])} />)

    expect(screen.getByText(/아직 지원하지 않는 입력 유형/)).toBeInTheDocument()
    expect(screen.getByText("값")).toBeInTheDocument()
  })
})

describe("열 유형이 바뀌어도 값을 잃지 않는다 (FRT-213 회귀)", () => {
  it("tags 로 저장된 배열이 period 컬럼에서도 사라지지 않는다", () => {
    // 열 유형 변경은 저장된 값의 자료형과 컬럼 정의를 어긋나게 만든다. 값을 빈 문자열로
    // 덮으면 사용자가 쓴 내용이 조용히 증발한다 — 배열도 텍스트로 접어 보존해야 한다.
    const columns = [{ key: "period", label: "기간", blockType: "period" as const }]
    render(
      <Harness
        readOnly
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { period: ["2023.03", "2024.01"] } }])}
      />,
    )

    expect(screen.getByText("2023.03, 2024.01")).toBeInTheDocument()
  })

  // file 컬럼은 객체만 읽으므로 옛 문자열이 화면에서 통째로 사라진다. 값 자체는 남아 있지만
  // 보이지 않으니, 사용자는 파일을 올려 그 값을 덮어쓰는 줄도 모른 채 잃는다.
  it("텍스트로 저장된 값이 file 컬럼에서도 보인다", () => {
    const columns = [{ key: "out", label: "결과물", blockType: "file" as const }]
    render(
      <Harness block={makeBlockWithColumns(columns, [{ id: "r1", cells: { out: "발표자료 링크" } }])} />,
    )

    expect(screen.getByText(/발표자료 링크/)).toBeInTheDocument()
  })

  // 반대 방향도 같다 — file 로 올린 첨부가 남은 채 열을 tags/checklist 로 바꾸면
  // 배열 정규화가 객체를 빈 배열로 접어버려 첨부가 화면에서 사라진다(태그를 하나 넣으면 덮어쓴다).
  it("첨부가 남은 채 tags 로 바뀌어도 파일명이 보인다", () => {
    const columns = [{ key: "out", label: "결과물", blockType: "tags" as const }]
    render(
      <Harness
        block={makeBlockWithColumns(columns, [
          { id: "r1", cells: { out: { type: "file", fileId: "f1", fileName: "발표자료.pdf" } } },
        ])}
      />,
    )

    expect(screen.getByText(/발표자료\.pdf/)).toBeInTheDocument()
  })

  it("첨부가 남은 채 checklist 로 바뀌어도 파일명이 보인다", () => {
    const columns = [
      { key: "out", label: "결과물", blockType: "checklist" as const, options: ["A", "B"] },
    ]
    render(
      <Harness
        block={makeBlockWithColumns(columns, [
          { id: "r1", cells: { out: { type: "file", fileId: "f1", fileName: "발표자료.pdf" } } },
        ])}
      />,
    )

    expect(screen.getByText(/발표자료\.pdf/)).toBeInTheDocument()
  })

  // 스칼라 갈래도 마찬가지다 — date·period·single-select 는 파일명을 값으로 못 읽어
  // 입력칸이 비어 보이고, 그 위에 값을 넣으면 첨부가 조용히 대체된다.
  it.each([
    ["date" as const],
    ["period" as const],
    ["single-select" as const],
    ["text" as const],
  ])("첨부가 남은 채 %s 로 바뀌어도 파일명이 보인다", blockType => {
    const columns = [{ key: "out", label: "결과물", blockType }]
    render(
      <Harness
        block={makeBlockWithColumns(columns, [
          { id: "r1", cells: { out: { type: "file", fileId: "f1", fileName: "발표자료.pdf" } } },
        ])}
      />,
    )

    expect(screen.getByText(/발표자료\.pdf/)).toBeInTheDocument()
  })

  it("조회 화면에서도 file 컬럼의 옛 텍스트가 사라지지 않는다", () => {
    const columns = [{ key: "out", label: "결과물", blockType: "file" as const }]
    render(
      <Harness
        readOnly
        block={makeBlockWithColumns(columns, [{ id: "r1", cells: { out: "발표자료 링크" } }])}
      />,
    )

    expect(screen.getByText(/발표자료 링크/)).toBeInTheDocument()
  })
})

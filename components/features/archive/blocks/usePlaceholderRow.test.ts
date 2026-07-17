import { describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"

import { usePlaceholderRow } from "./usePlaceholderRow"
import type { BlockColumnDef, BlockRow } from "@/types/archive"

const COLUMNS: BlockColumnDef[] = [
  { key: "item", label: "활동 / 성과", blockType: "text" },
]

const TABLE_COLUMNS: BlockColumnDef[] = [
  { key: "name", label: "이름", blockType: "text" },
  { key: "stack", label: "스택", blockType: "tags" },
]

function row(id: string, item: string): BlockRow {
  return { id, cells: { item } }
}

describe("usePlaceholderRow", () => {
  it("rows 가 비면 표시용 행 하나를 파생한다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], COLUMNS))
    expect(result.current.displayRows).toHaveLength(1)
    expect(result.current.placeholder).not.toBeNull()
    expect(result.current.hasPlaceholder).toBe(true)
    expect(result.current.displayRows[0].cells.item).toBe("")
  })

  // '추가' 버튼 은닉은 hasPlaceholder 로만 판정해야 한다 — rows.length===0 으로 판정하면
  // 컬럼이 없어 빈 줄을 못 그리는 블록에서 줄도 버튼도 없는 막다른 길이 된다.
  it("컬럼이 없으면 rows 가 비어도 hasPlaceholder 는 false 다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], []))
    expect(result.current.hasPlaceholder).toBe(false)
    expect(result.current.displayRows).toHaveLength(0)
  })

  it("파생한 행은 컬럼 타입에 맞는 빈 셀을 갖는다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], TABLE_COLUMNS))
    expect(result.current.displayRows[0].cells).toEqual({ name: "", stack: [] })
  })

  it("rows 가 있으면 그대로 통과시키고 placeholder 를 만들지 않는다", () => {
    const rows = [row("row-0", "A")]
    const { result } = renderHook(() => usePlaceholderRow(rows, COLUMNS))
    expect(result.current.displayRows).toBe(rows)
    expect(result.current.placeholder).toBeNull()
  })

  it("같은 빈 상태로 다시 렌더해도 placeholder id 가 바뀌지 않는다(리마운트 방지)", () => {
    const { result, rerender } = renderHook(() => usePlaceholderRow([], COLUMNS))
    const first = result.current.placeholder!.id
    rerender()
    expect(result.current.placeholder!.id).toBe(first)
  })

  it("비었다→찼다→다시 비면 낡은 id 를 재사용하지 않고 새 id 를 만든다", () => {
    let rows: BlockRow[] = []
    const { result, rerender } = renderHook(() => usePlaceholderRow(rows, COLUMNS))
    const firstId = result.current.placeholder!.id

    // 실체화: placeholder 와 같은 id 로 커밋된 상황을 재현한다.
    rows = [row(firstId, "A")]
    rerender()
    expect(result.current.placeholder).toBeNull()

    // 사용자가 전부 삭제해 다시 빈 상태로.
    rows = []
    rerender()
    expect(result.current.placeholder!.id).not.toBe(firstId)
  })

  it("isPlaceholderRow 는 파생된 행만 참으로 본다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], COLUMNS))
    expect(result.current.isPlaceholderRow(result.current.placeholder!.id)).toBe(true)
    expect(result.current.isPlaceholderRow("row-0")).toBe(false)
  })

  it("rows 가 차 있으면 어떤 id 도 placeholder 로 보지 않는다", () => {
    const { result } = renderHook(() => usePlaceholderRow([row("row-0", "A")], COLUMNS))
    expect(result.current.isPlaceholderRow("row-0")).toBe(false)
  })

  it("컬럼이 없으면 placeholder 를 만들지 않는다(그릴 셀이 없다)", () => {
    const { result } = renderHook(() => usePlaceholderRow([], []))
    expect(result.current.placeholder).toBeNull()
    expect(result.current.displayRows).toHaveLength(0)
  })

  it("materialize 는 값이 채워졌을 때만 실체화할 행을 준다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], TABLE_COLUMNS))
    const id = result.current.placeholder!.id

    expect(result.current.materialize(id, "name", "")).toBeNull()
    expect(result.current.materialize(id, "name", "   ")).toBeNull()
    expect(result.current.materialize(id, "stack", [])).toBeNull()

    const materialized = result.current.materialize(id, "name", "ARC")
    expect(materialized).toEqual({ id, cells: { name: "ARC", stack: [] } })
  })

  it("placeholder 가 아닌 id 로는 materialize 하지 않는다", () => {
    const { result } = renderHook(() => usePlaceholderRow([], COLUMNS))
    expect(result.current.materialize("row-0", "item", "A")).toBeNull()
  })

  it("act 로 감싼 재렌더에서도 파생이 안정적이다", () => {
    const { result, rerender } = renderHook(() => usePlaceholderRow([], COLUMNS))
    const id = result.current.placeholder!.id
    act(() => rerender())
    expect(result.current.placeholder!.id).toBe(id)
  })
})

import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useLibraryFilter } from "./useLibraryFilter"
import type { ExperienceV2, LibraryFilter } from "@/types/archive"

const EMPTY: ExperienceV2[] = []

describe("useLibraryFilter initialFilter", () => {
  it("initialFilter 를 생략하면 기존 디폴트({sortBy:'updated'})로 시작한다", () => {
    const { result } = renderHook(() => useLibraryFilter(EMPTY))
    expect(result.current.filter).toEqual({ sortBy: "updated" })
    expect(result.current.isFilterActive).toBe(false)
  })

  it("initialFilter 를 주면 첫 렌더의 filter 에 그대로 반영한다", () => {
    const initial: LibraryFilter = {
      search: "네이버",
      sortBy: "period",
      statuses: ["complete"],
    }
    const { result } = renderHook(() => useLibraryFilter(EMPTY, initial))
    expect(result.current.filter).toEqual(initial)
    expect(result.current.isFilterActive).toBe(true)
  })

  it("clearFilters 는 initialFilter 가 있어도 무필터 디폴트로 되돌린다", () => {
    const initial: LibraryFilter = { search: "x", statuses: ["draft"] }
    const { result, rerender } = renderHook(() => useLibraryFilter(EMPTY, initial))
    result.current.clearFilters()
    rerender()
    expect(result.current.filter).toEqual({ sortBy: "updated" })
    expect(result.current.isFilterActive).toBe(false)
  })
})

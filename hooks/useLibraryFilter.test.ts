import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useLibraryFilter, matchesFilter } from "./useLibraryFilter"
import type { ExperienceTypeId, ExperienceV2, LibraryFilter } from "@/types/archive"

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

/**
 * 은퇴한 유형(FRT-291 `team-project`)이 필터에서 사라지지 않는지.
 *
 * 유형 목록(`EXPERIENCE_TYPES`)에서 내린 id 는 **칩이 만들어지지 않으므로** 사용자가 그 id 를
 * 필터에 담을 방법이 없다. 그런데 저장된 레코드에는 그 id 가 그대로 남아 있어, 정확 일치로 걸러
 * 내면 '프로젝트' 칩을 누른 순간 옛 팀 프로젝트 기록이 통째로 목록에서 빠지고 **되돌릴 방법이
 * 없다**(그 칩 자체가 없다). 두 id 는 사용자에게 이미 같은 이름의 한 유형이므로 접어서 본다.
 */
describe("matchesFilter — 은퇴 유형 접기", () => {
  function exp(typeId: ExperienceTypeId): ExperienceV2 {
    return {
      id: "e1",
      userId: "u1",
      typeId,
      title: "졸업작품",
      summary: "",
      status: "complete",
      tags: [],
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
      hiddenKeys: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }
  }

  it("'프로젝트' 칩(personal-project)은 옛 team-project 레코드도 포함한다", () => {
    expect(matchesFilter(exp("team-project"), { typeIds: ["personal-project"] })).toBe(true)
  })

  it("옛 URL 이 실어 온 team-project 필터도 현행 레코드를 포함한다", () => {
    expect(matchesFilter(exp("personal-project"), { typeIds: ["team-project"] })).toBe(true)
  })

  it("다른 유형까지 통과시키지는 않는다", () => {
    expect(matchesFilter(exp("creative-work"), { typeIds: ["personal-project"] })).toBe(false)
    expect(matchesFilter(exp("team-project"), { typeIds: ["creative-work"] })).toBe(false)
  })
})

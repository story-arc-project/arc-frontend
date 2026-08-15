import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useLibraryFilter, matchesFilter } from "./useLibraryFilter"
import { toExperienceV2 } from "@/lib/utils/experience-mapper"
import { TEMPLATE_VERSION } from "@/lib/constants/templates-v2"
import type { ExperienceTypeId, ExperienceV2, LibraryFilter } from "@/types/archive"
import type { Experience } from "@/types/experience"

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

// ─── FRT-200: 손상된 저장 값이 목록 전체를 무너뜨리지 않는다 ──────────
//
// 기간 정렬은 `aStart?.value.type` 으로 값을 읽는다 — optional chaining 이 블록만 보호하고
// **value 는 보호하지 않는다.** 그래서 경험 **하나**의 기간 값이 깨지면 상세 화면이 아니라
// **라이브러리 목록 전체**가 무너진다. 방어는 매퍼(`toExperienceV2`)가 하므로, 이 테스트는
// "매퍼를 거친 값은 안전하다"는 전제 자체를 잠근다 — 훅에 방어 코드를 넣어 잠그는 게 아니다.

describe("기간 정렬 — 손상된 저장 값 (FRT-200)", () => {
  function loadWithPeriod(id: string, period: unknown): ExperienceV2 {
    return toExperienceV2({
      id,
      user_id: "user-1",
      type: "career",
      importance: null,
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: id,
        summary: "",
        status: "draft",
        tags: [],
        fields: { "core.기간": period },
        custom: [],
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    } as unknown as Experience)
  }

  it("기간 값이 깨진 경험이 섞여 있어도 목록이 뜨고 정렬된다", () => {
    const experiences = [
      loadWithPeriod("깨진 것", null),
      loadWithPeriod("멀쩡한 것", { type: "period", start: "2023.05", end: "2023.12", isCurrent: false }),
      loadWithPeriod("반만 깨진 것", { type: "period", start: "2024.01", end: null }),
    ]

    const { result } = renderHook(() => useLibraryFilter(experiences, { sortBy: "period" }))
    expect(result.current.filteredExperiences).toHaveLength(3)
    // 시작월 내림차순 — 반만 깨진 것도 살아 있는 start 로 제자리를 찾는다.
    expect(result.current.filteredExperiences.map(e => e.title)).toEqual([
      "반만 깨진 것",
      "멀쩡한 것",
      "깨진 것",
    ])
  })
})

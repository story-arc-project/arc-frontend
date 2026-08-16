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

/**
 * 코어 '기간'을 뺀 유형의 기간 정렬 (FRT-291 리뷰).
 *
 * 확정본 정렬로 여러 유형이 `CORE_EXCLUDE` 를 통해 코어 '기간'을 내리고 자기 라벨
 * (`진행 기간`·`연구 기간`…)로 시점을 옮겼다. 그런데 정렬은 `coreBlocks` 만 훑으므로 그 유형들은
 * 전부 "시점 없음"으로 같아져 **기간 정렬이 아무 일도 하지 않는다** — 사용자는 드롭다운을
 * 골랐는데 순서가 그대로인 화면을 본다. 발행 경로가 `TYPE_PERIOD_KEY` 로 이미 푼 문제를
 * 목록 정렬만 못 받고 있었다.
 */
describe("기간 정렬 — 코어 밖으로 옮겨간 시점 (FRT-291 리뷰)", () => {
  function projectWithPeriod(id: string, start: string): ExperienceV2 {
    return toExperienceV2({
      id,
      user_id: "user-1",
      type: "personal-project",
      importance: null,
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: id,
        summary: "",
        status: "draft",
        tags: [],
        // 확정본 ① 이 소유하는 시점 — 코어가 아니라 유형 섹션의 안정키에 저장된다.
        fields: {
          "project-info.진행 기간": { type: "period", start, end: "", isCurrent: false },
        },
        custom: [],
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    } as unknown as Experience)
  }

  it("코어에 기간이 없어도 유형 섹션의 시점으로 정렬된다", () => {
    const experiences = [
      projectWithPeriod("가운데", "2023.06"),
      projectWithPeriod("가장 오래된", "2021.03"),
      projectWithPeriod("가장 최근", "2025.01"),
    ]

    const { result } = renderHook(() => useLibraryFilter(experiences, { sortBy: "period" }))

    expect(result.current.filteredExperiences.map(e => e.title)).toEqual([
      "가장 최근",
      "가운데",
      "가장 오래된",
    ])
  })

  /**
   * 픽스처가 정말 "코어에 기간이 없는" 상태인지 따로 묻는다 — 코어에 값이 남아 있었다면 위
   * 테스트는 기존 경로로 통과해 **새 폴백을 하나도 검증하지 못한 채 초록**이 된다.
   */
  it("전제 확인 — 이 픽스처의 코어에는 기간 블록의 값이 없다", () => {
    const exp = projectWithPeriod("확인용", "2023.06")
    const core = exp.coreBlocks.find(b => b.label === "기간")
    expect(core?.value.type === "period" ? core.value.start : "").toBeFalsy()
    expect(
      exp.extensionBlocks.some(b => b.label === "진행 기간" && b.value.type === "period"),
    ).toBe(true)
  })

  /**
   * 폴백은 '기간' 시맨틱 그룹의 라벨만 집어야 한다 — 이 게이트를 지우면 배열에서 먼저 나오는
   * 아무 period 블록이 정렬 키가 된다. 지금 템플릿들은 최상위 period 필드가 유형당 하나뿐이라
   * 게이트가 안전망으로만 존재하고, 그래서 기존 그물로는 제거가 보이지 않았다(/code-review high).
   * 미끼('휴학 기간')를 진짜('진행 기간')보다 **앞에** 두어 게이트 유무로 순서가 갈리게 한다.
   */
  it("시맨틱 그룹 밖의 period 블록은 정렬 키가 되지 않는다", () => {
    const withDecoy = (id: string, decoyStart: string, realStart: string): ExperienceV2 => ({
      id,
      userId: "user-1",
      typeId: "personal-project" as ExperienceTypeId,
      title: id,
      summary: "",
      status: "draft",
      tags: [],
      hiddenKeys: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      coreBlocks: [],
      extensionBlocks: [
        {
          id: `${id}-decoy`,
          type: "period",
          label: "휴학 기간",
          value: { type: "period", start: decoyStart, end: "", isCurrent: false },
        },
        {
          id: `${id}-real`,
          type: "period",
          label: "진행 기간",
          value: { type: "period", start: realStart, end: "", isCurrent: false },
        },
      ],
      customBlocks: [],
    })
    // 미끼로 재면 옛것(2025 > 2020)이, 진짜로 재면 최신(2024 > 2021)이 앞선다.
    const older = withDecoy("진짜가 오래된 쪽", "2025.01", "2021.01")
    const newer = withDecoy("진짜가 최신인 쪽", "2020.01", "2024.01")

    const { result } = renderHook(() => useLibraryFilter([older, newer], { sortBy: "period" }))

    expect(result.current.filteredExperiences.map(e => e.title)).toEqual([
      "진짜가 최신인 쪽",
      "진짜가 오래된 쪽",
    ])
  })
})

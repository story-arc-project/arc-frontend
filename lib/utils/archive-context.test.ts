import { describe, expect, it } from "vitest"
import {
  serializeArchiveContext,
  parseArchiveContext,
  buildReturnTo,
  withIdInReturnTo,
  type ArchiveContext,
} from "@/lib/utils/archive-context"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"

const DEFAULT_FILTER = { sortBy: "updated" as const }

describe("serializeArchiveContext", () => {
  it("디폴트(전체 라이브러리 + updated 정렬)는 빈 문자열로 직렬화한다", () => {
    expect(
      serializeArchiveContext({ libraryId: ALL_LIBRARY_ID, filter: DEFAULT_FILTER }),
    ).toBe("")
  })

  it("수동 라이브러리 id를 lib 파라미터로 싣는다", () => {
    const qs = serializeArchiveContext({ libraryId: "lib-123", filter: DEFAULT_FILTER })
    const params = new URLSearchParams(qs)
    expect(params.get("lib")).toBe("lib-123")
  })

  it("검색어·정렬·유형·상태 필터를 각 파라미터로 싣는다", () => {
    const qs = serializeArchiveContext({
      libraryId: ALL_LIBRARY_ID,
      filter: {
        search: "네이버",
        sortBy: "period",
        typeIds: ["career", "award"],
        statuses: ["complete"],
      },
    })
    const params = new URLSearchParams(qs)
    expect(params.get("q")).toBe("네이버")
    expect(params.get("sort")).toBe("period")
    expect(params.get("type")).toBe("career,award")
    expect(params.get("status")).toBe("complete")
  })

  it("빈 배열 필터는 파라미터를 만들지 않는다", () => {
    const qs = serializeArchiveContext({
      libraryId: ALL_LIBRARY_ID,
      filter: { sortBy: "updated", typeIds: [], statuses: [] },
    })
    expect(qs).toBe("")
  })
})

describe("parseArchiveContext", () => {
  it("관련 파라미터가 전혀 없으면 undefined를 반환한다", () => {
    expect(parseArchiveContext(new URLSearchParams(""))).toBeUndefined()
  })

  it("id 파라미터만 있으면(복귀 후 정상 URL) undefined를 반환한다", () => {
    expect(parseArchiveContext(new URLSearchParams("id=exp-1"))).toBeUndefined()
  })

  it("lib 파라미터를 libraryId로 복원한다", () => {
    const ctx = parseArchiveContext(new URLSearchParams("lib=lib-123"))
    expect(ctx?.libraryId).toBe("lib-123")
  })

  it("검색어·정렬·유형·상태를 filter로 복원한다", () => {
    const ctx = parseArchiveContext(
      new URLSearchParams("q=네이버&sort=period&type=career,award&status=complete"),
    )
    expect(ctx?.libraryId).toBe(ALL_LIBRARY_ID)
    expect(ctx?.filter.search).toBe("네이버")
    expect(ctx?.filter.sortBy).toBe("period")
    expect(ctx?.filter.typeIds).toEqual(["career", "award"])
    expect(ctx?.filter.statuses).toEqual(["complete"])
  })

  it("화이트리스트에 없는 유형/상태/정렬 값은 조용히 버린다", () => {
    const ctx = parseArchiveContext(
      new URLSearchParams("lib=lib-1&type=career,__bogus__&status=__x__&sort=__nope__"),
    )
    expect(ctx?.filter.typeIds).toEqual(["career"])
    expect(ctx?.filter.statuses).toBeUndefined()
    expect(ctx?.filter.sortBy).toBeUndefined()
  })

  it("유효한 파라미터가 하나도 남지 않으면 undefined를 반환한다", () => {
    const ctx = parseArchiveContext(new URLSearchParams("type=__a__,__b__&status=__x__"))
    expect(ctx).toBeUndefined()
  })
})

describe("serialize ↔ parse round-trip", () => {
  it("전체 필드를 왕복 보존한다", () => {
    const ctx: ArchiveContext = {
      libraryId: "lib-xyz",
      filter: {
        search: "부스트캠프",
        sortBy: "completion",
        typeIds: ["extracurricular"],
        statuses: ["draft", "complete"],
      },
    }
    const restored = parseArchiveContext(new URLSearchParams(serializeArchiveContext(ctx)))
    expect(restored).toEqual(ctx)
  })

  it("디폴트 컨텍스트는 왕복 시 undefined가 된다", () => {
    const ctx: ArchiveContext = { libraryId: ALL_LIBRARY_ID, filter: DEFAULT_FILTER }
    const restored = parseArchiveContext(new URLSearchParams(serializeArchiveContext(ctx)))
    expect(restored).toBeUndefined()
  })
})

describe("buildReturnTo", () => {
  it("basePath + /archive 에 컨텍스트 쿼리를 붙인다", () => {
    const url = buildReturnTo("", { libraryId: "lib-123", filter: DEFAULT_FILTER })
    expect(url).toBe("/archive?lib=lib-123")
  })

  it("디폴트 컨텍스트면 쿼리 없는 /archive 를 만든다", () => {
    expect(buildReturnTo("", { libraryId: ALL_LIBRARY_ID, filter: DEFAULT_FILTER })).toBe(
      "/archive",
    )
  })

  it("id를 함께 실으면 id 파라미터를 추가한다", () => {
    const url = buildReturnTo("", { libraryId: "lib-1", filter: DEFAULT_FILTER }, "exp-9")
    const [path, qs] = url.split("?")
    expect(path).toBe("/archive")
    const params = new URLSearchParams(qs)
    expect(params.get("lib")).toBe("lib-1")
    expect(params.get("id")).toBe("exp-9")
  })

  it("/demo basePath를 그대로 내장한다", () => {
    const url = buildReturnTo("/demo", { libraryId: "lib-1", filter: DEFAULT_FILTER })
    expect(url).toBe("/demo/archive?lib=lib-1")
  })
})

describe("withIdInReturnTo", () => {
  it("쿼리가 없던 returnTo에 id를 추가한다", () => {
    expect(withIdInReturnTo("/archive", "exp-5")).toBe("/archive?id=exp-5")
  })

  it("기존 컨텍스트 쿼리를 유지한 채 id를 추가한다", () => {
    const out = withIdInReturnTo("/archive?lib=lib-1", "exp-5")
    const [path, qs] = out.split("?")
    expect(path).toBe("/archive")
    const params = new URLSearchParams(qs)
    expect(params.get("lib")).toBe("lib-1")
    expect(params.get("id")).toBe("exp-5")
  })

  it("이미 있던 id를 새 값으로 교체한다", () => {
    const out = withIdInReturnTo("/archive?lib=lib-1&id=old", "new")
    const params = new URLSearchParams(out.split("?")[1])
    expect(params.get("id")).toBe("new")
    expect(params.getAll("id")).toEqual(["new"])
  })

  it("/demo basePath 경로를 보존한다", () => {
    expect(withIdInReturnTo("/demo/archive?lib=lib-1", "exp-2")).toContain("/demo/archive?")
  })
})

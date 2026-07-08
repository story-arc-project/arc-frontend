import { describe, expect, it } from "vitest"
import {
  serializeArchiveContext,
  parseArchiveContext,
  buildReturnTo,
  safeReturnTo,
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

  it("검색어의 예약문자(&·?)를 왕복 보존한다(이중 디코딩 회귀 가드)", () => {
    // 검색어에 & 가 있으면 직렬화 시 %26 으로 인코딩돼야 하고, parse 는 이를 다시 & 로
    // 복원해야 한다. 소비 측이 값을 한 번 더 디코딩하면 이 경계가 깨진다(Codex P2).
    const ctx: ArchiveContext = { libraryId: ALL_LIBRARY_ID, filter: { search: "C&A?B" } }
    const qs = serializeArchiveContext(ctx)
    expect(qs).not.toContain("C&A") // 리터럴 & 가 그대로 새면 안 된다
    expect(parseArchiveContext(new URLSearchParams(qs))?.filter.search).toBe("C&A?B")
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

describe("safeReturnTo", () => {
  const FALLBACK = "/archive?id=exp-1"

  it("null·빈 값이면 fallback을 반환한다", () => {
    expect(safeReturnTo(null, "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("", "", FALLBACK)).toBe(FALLBACK)
  })

  it("현재 basePath 의 archive 상대경로만 그대로 통과시킨다", () => {
    expect(safeReturnTo("/archive?q=x&id=exp-2", "", FALLBACK)).toBe("/archive?q=x&id=exp-2")
    expect(safeReturnTo("/archive", "", FALLBACK)).toBe("/archive")
    expect(safeReturnTo("/demo/archive?lib=lib-1", "/demo", "/demo/archive")).toBe(
      "/demo/archive?lib=lib-1",
    )
  })

  it("다른 앱 컨텍스트(basePath 불일치)의 archive 경로는 fallback으로 막는다", () => {
    // /demo 플로우의 returnTo 를 메인 archive 로 넘기거나 그 반대 — 컨텍스트 이탈(P2).
    expect(safeReturnTo("/demo/archive?lib=lib-1", "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("/archive", "/demo", "/demo/archive")).toBe("/demo/archive")
    // 존재하지 않는 세그먼트는 404 를 유발하므로 통과시키지 않는다.
    expect(safeReturnTo("/foo/archive", "", FALLBACK)).toBe(FALLBACK)
  })

  it("인코딩된 내부 쿼리(%26)를 디코딩하지 않고 그대로 통과시킨다", () => {
    // 소비 측은 이 반환값을 router.push 에 그대로 넣는다 — 여기서 디코딩하면 이중 디코딩.
    expect(safeReturnTo("/archive?q=C%26A", "", FALLBACK)).toBe("/archive?q=C%26A")
  })

  it("외부 URL·프로토콜상대·javascript 스킴은 fallback으로 무력화한다(P1 오픈리다이렉트)", () => {
    expect(safeReturnTo("https://evil.com", "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("//evil.com/archive", "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("javascript:alert(1)", "", FALLBACK)).toBe(FALLBACK)
  })

  it("archive 목록 경로가 아닌 상대경로는 fallback으로 막는다", () => {
    expect(safeReturnTo("/settings", "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("/archive/exp-1/edit", "", FALLBACK)).toBe(FALLBACK)
    expect(safeReturnTo("/archive/../secret", "", FALLBACK)).toBe(FALLBACK)
  })
})

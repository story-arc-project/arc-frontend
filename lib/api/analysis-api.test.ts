import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiSuccessResponse } from "@/types/api"

// shouldMock() 이 mock 픽스처 분기로 새지 않도록 실 경로를 강제한다.
// (이게 없으면 매퍼가 아니라 mock 데이터를 검증하게 됨)
vi.mock("@/lib/demo/state", () => ({
  isDemoMode: () => false,
  setDemoMode: () => {},
  DEMO_BASE_PATH: "/demo",
}))

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}))

import { api } from "@/lib/api/client"
import {
  createComprehensiveAnalysis,
  createKeywordAnalysis,
  getBookmarks,
  getIndividualAnalysisList,
} from "@/lib/api/analysis-api"

const apiMock = vi.mocked(api)

function envelope(data: unknown): ApiSuccessResponse<unknown> {
  return { status: "success", message: "", data }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("getIndividualAnalysisList — 방어적 파싱", () => {
  it("snake_case 흡수·status 변환·빈 id 제거·단일 experience_id 정규화", async () => {
    apiMock.get.mockResolvedValue(
      envelope([
        {
          id: "a1",
          title: "분석1",
          status: "queued",
          is_bookmarked: true,
          created_at: "2024-01-01",
          selected_experience_ids: ["e1", "e2"],
        },
        { id: "a2", status: "success", experience_id: "e9" },
        { id: "a3", status: "failed" },
        { id: "a4", status: "정체불명" },
        { id: "" }, // 빈 id → 제거됨
      ]),
    )

    const list = await getIndividualAnalysisList()

    expect(list).toHaveLength(4)
    expect(list[0]).toMatchObject({
      id: "a1",
      title: "분석1",
      status: "processing", // queued → processing
      isBookmarked: true, // is_bookmarked 흡수
      createdAt: "2024-01-01", // created_at 흡수
      selectedExperienceIds: ["e1", "e2"], // selected_experience_ids 흡수
    })
    expect(list[1].status).toBe("completed") // success → completed
    expect(list[1].selectedExperienceIds).toEqual(["e9"]) // 단일 experience_id → 배열
    expect(list[2].status).toBe("failed") // passthrough
    expect(list[3].status).toBe("pending") // 알 수 없는 값 → pending
  })

  it("status 파라미터로 클라이언트 필터링한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([
        { id: "a1", status: "success" },
        { id: "a2", status: "pending" },
      ]),
    )
    const list = await getIndividualAnalysisList({ status: "completed" })
    expect(list.map((s) => s.id)).toEqual(["a1"])
  })

  it("'pending' 필터는 queued(→processing) 와 pending 을 모두 포함한다 (FRT-41 회귀)", async () => {
    apiMock.get.mockResolvedValue(
      envelope([
        { id: "a1", status: "queued" }, // → processing (대기 중)
        { id: "a2", status: "pending" }, // → pending (대기 중)
        { id: "a3", status: "success" }, // → completed (제외)
        { id: "a4", status: "failed" }, // → failed (제외)
      ]),
    )
    const list = await getIndividualAnalysisList({ status: "pending" })
    expect(list.map((s) => s.id)).toEqual(["a1", "a2"])
  })
})

describe("unwrapList — 목록 봉투 형태 수용", () => {
  const snap = { id: "x", status: "completed" }

  it.each([
    ["배열", [snap]],
    ["{ items }", { items: [snap] }],
    ["{ contents }", { contents: [snap] }],
    ["{ data }", { data: [snap] }],
  ])("data 가 %s 형태여도 항목을 추출한다", async (_label, shape) => {
    apiMock.get.mockResolvedValue(envelope(shape))
    const list = await getIndividualAnalysisList()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe("x")
  })
})

describe("getBookmarks — isBookmarked/bookmarkedAt 폴백", () => {
  it("is_bookmarked:false 입력이라도 isBookmarked 를 true 로 강제한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([{ id: "b1", created_at: "2024-02-02", is_bookmarked: false }]),
    )
    const bms = await getBookmarks()
    expect(bms[0].isBookmarked).toBe(true)
  })

  it("bookmarked_at 부재 시 createdAt 으로 폴백한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([{ id: "b1", created_at: "2024-02-02" }]),
    )
    const bms = await getBookmarks()
    expect(bms[0].bookmarkedAt).toBe("2024-02-02")
  })

  it("bookmarked_at 가 있으면 그 값을 쓴다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([{ id: "b1", created_at: "2024-02-02", bookmarked_at: "2024-03-03" }]),
    )
    const bms = await getBookmarks()
    expect(bms[0].bookmarkedAt).toBe("2024-03-03")
  })
})

describe("create*Analysis — 응답 ID 부재 처리 (FRT-38)", () => {
  it("종합 분석: 응답에 id 가 없으면 analysisId: null 을 반환한다 (오류로 보지 않음)", async () => {
    apiMock.post.mockResolvedValue(envelope({ status: "queued", message: "시작됨" }))
    expect(await createComprehensiveAnalysis(["e1"])).toEqual({ analysisId: null })
  })

  it("종합 분석: id 또는 analysis_id 가 있으면 analysisId 를 반환한다", async () => {
    apiMock.post.mockResolvedValueOnce(envelope({ id: "comp-1" }))
    expect(await createComprehensiveAnalysis(["e1"])).toEqual({ analysisId: "comp-1" })

    apiMock.post.mockResolvedValueOnce(envelope({ analysis_id: "comp-2" }))
    expect(await createComprehensiveAnalysis(["e1"])).toEqual({ analysisId: "comp-2" })
  })

  it("키워드 분석: 응답에 id 가 없으면 analysisId: null 을 반환한다 (오류로 보지 않음)", async () => {
    apiMock.post.mockResolvedValue(envelope({ status: "queued" }))
    expect(await createKeywordAnalysis(["성장"])).toEqual({ analysisId: null })
  })

  it("키워드 분석: id 가 있으면 analysisId 를 반환한다", async () => {
    apiMock.post.mockResolvedValueOnce(envelope({ id: "kw-1" }))
    expect(await createKeywordAnalysis(["성장"])).toEqual({ analysisId: "kw-1" })
  })
})

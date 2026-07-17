import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiSuccessResponse } from "@/types/api"
import type {
  IndividualAnalysisResult,
  ComprehensiveAnalysisResult,
  KeywordAnalysisResult,
} from "@/types/analysis"

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
  getIndividualAnalysisResult,
  getComprehensiveResult,
  getComprehensiveList,
  getKeywordResult,
  updateAnalysisMeta,
  UnsupportedSchemaError,
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

  it("종합 분석: id 가 최상위(`{ status, message, id }`)에 와도 추출한다 (BE 문서 스펙)", async () => {
    apiMock.post.mockResolvedValue({ status: "success", message: "시작됨", id: "comp-top" })
    expect(await createComprehensiveAnalysis(["e1"])).toEqual({ analysisId: "comp-top" })
  })

  it("키워드 분석: 응답에 id 가 없으면 analysisId: null 을 반환한다 (오류로 보지 않음)", async () => {
    apiMock.post.mockResolvedValue(envelope({ status: "queued" }))
    expect(await createKeywordAnalysis(["성장"])).toEqual({ analysisId: null })
  })

  it("키워드 분석: id 가 있으면 analysisId 를 반환한다", async () => {
    apiMock.post.mockResolvedValueOnce(envelope({ id: "kw-1" }))
    expect(await createKeywordAnalysis(["성장"])).toEqual({ analysisId: "kw-1" })
  })

  it("키워드 분석: id 가 최상위(`{ status, message, id }`)에 와도 추출한다 (BE 문서 스펙)", async () => {
    apiMock.post.mockResolvedValue({ status: "success", message: "시작됨", id: "kw-top" })
    expect(await createKeywordAnalysis(["성장"])).toEqual({ analysisId: "kw-top" })
  })

  it("키워드 분석: target 을 body 에 실어 보낸다 (계약 §2.3). 미지정 시 빈 문자열", async () => {
    apiMock.post.mockResolvedValue(envelope({ id: "kw-1" }))
    await createKeywordAnalysis(["리더십"], "스타트업 PM")
    expect(apiMock.post).toHaveBeenCalledWith("/analysis/keyword", {
      keywords: ["리더십"],
      target: "스타트업 PM",
    })

    apiMock.post.mockClear()
    await createKeywordAnalysis(["리더십"])
    expect(apiMock.post).toHaveBeenCalledWith("/analysis/keyword", {
      keywords: ["리더십"],
      target: "",
    })
  })
})

describe("getIndividualAnalysisResult — isBookmarked 방어 파싱 (FRT-64)", () => {
  const minimalResult = {
    itemName: "",
    itemType: "",
    briefSummary: "",
    deepAnalysis: {},
    starFormat: {},
    itemDiagnosis: {},
    synergyRecommendations: [],
    actionPlan: {},
    missingInfoWarning: "",
  }

  it("snake_case is_bookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", is_bookmarked: true, result: minimalResult }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("camelCase isBookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", isBookmarked: true, result: minimalResult }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("필드 부재 시 isBookmarked:false (기본값)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", result: minimalResult }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.isBookmarked).toBe(false)
  })
})

describe("getComprehensiveResult — isBookmarked 방어 파싱 (FRT-64)", () => {
  it("snake_case is_bookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", is_bookmarked: true }),
    )
    const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("camelCase isBookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", isBookmarked: true }),
    )
    const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("필드 부재 시 isBookmarked:false (기본값)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed" }),
    )
    const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
    expect(res.isBookmarked).toBe(false)
  })
})

describe("getKeywordResult — isBookmarked 방어 파싱 (FRT-64)", () => {
  it("snake_case is_bookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", is_bookmarked: true, keywords: [] }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("camelCase isBookmarked:true → isBookmarked:true", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", isBookmarked: true, keywords: [] }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
    expect(res.isBookmarked).toBe(true)
  })

  it("필드 부재 시 isBookmarked:false (기본값)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", keywords: [] }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
    expect(res.isBookmarked).toBe(false)
  })
})

describe("experiences 매핑 — BAC-58 / 계약 §2.2 (FRT-123)", () => {
  it("종합 목록: experiences[{id,title}] 를 파싱하고 title=null 을 보존한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([
        {
          id: "comp-1",
          type: "comprehensive",
          status: "success",
          experiences: [
            { id: "e1", title: "학회 활동" },
            { id: "e2", title: null }, // 삭제된 경험
          ],
        },
      ]),
    )
    const list = await getComprehensiveList()
    expect(list[0].experiences).toEqual([
      { id: "e1", title: "학회 활동" },
      { id: "e2", title: null },
    ])
  })

  it("종합 목록: experiences 부재 시 undefined (구 백엔드 폴백)", async () => {
    apiMock.get.mockResolvedValue(
      envelope([{ id: "comp-1", type: "comprehensive", status: "success", experience_count: 3 }]),
    )
    const list = await getComprehensiveList()
    expect(list[0].experiences).toBeUndefined()
    expect(list[0].experienceCount).toBe(3)
  })

  it("종합 단건: 엔벨로프 최상위 experiences 를 읽는다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "comp-1",
        status: "success",
        experiences: [{ id: "e1", title: "프로젝트" }, { id: "e2", title: null }],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.experiences).toEqual([
      { id: "e1", title: "프로젝트" },
      { id: "e2", title: null },
    ])
  })
})

describe("키워드 v4.1 매퍼 (FRT-123 Phase 2)", () => {
  it("A_ 접두사 키를 읽는다 (계약 미이행 백엔드 방어)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          A_keyword_definitions: [{ keyword: "리더십", definition: "d", synonyms: [] }],
          C_coverage: [{ keyword: "리더십", related_count: 2, total_count: 5 }],
          D_matched_experiences: [{ keyword: "리더십", experiences: [] }],
          E_storylines: [{ keyword: "리더십" }],
          F_improvement_guide: {},
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].keyword).toBe("리더십")
    expect(res.coverage[0].relatedCount).toBe(2)
    expect(res.matchedExperiences[0].keyword).toBe("리더십")
    expect(res.storylines[0].keyword).toBe("리더십")
  })

  it("compliance_criteria 를 객체 배열로 파싱한다 (id·criterion·signal)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          keyword_definitions: [
            {
              keyword: "협업",
              compliance_criteria: [
                { id: 1, criterion: "기준1", signal_description: "신호1" },
                { id: 2, criterion: "기준2", signal_description: "신호2" },
              ],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].complianceCriteria).toEqual([
      { id: 1, criterion: "기준1", signalDescription: "신호1" },
      { id: 2, criterion: "기준2", signalDescription: "신호2" },
    ])
  })

  it("구버전 compliance_criteria(문자열 배열)도 객체로 흡수한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          keyword_definitions: [{ keyword: "협업", compliance_criteria: ["기준A", "기준B"] }],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].complianceCriteria).toEqual([
      { id: 1, criterion: "기준A", signalDescription: "" },
      { id: 2, criterion: "기준B", signalDescription: "" },
    ])
  })

  it("matched_criteria: 숫자·숫자문자열은 number 로, 비숫자 문자열(구버전 서술기준)은 보존한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          matched_experiences: [
            {
              keyword: "협업",
              experiences: [
                { career_title: "경험", matched_criteria: [1, "3", "기준 서술문", 5, "", null], is_reference_only: true, relevance_summary: "요약" },
              ],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    const exp = res.matchedExperiences[0].experiences[0]
    // 빈 문자열·null 은 버리고, 숫자문자열은 number 로, 서술 문자열은 그대로 보존(백지 방지)
    expect(exp.matchedCriteria).toEqual([1, 3, "기준 서술문", 5])
    expect(exp.isReferenceOnly).toBe(true)
    expect(exp.relevanceSummary).toBe("요약")
  })

  it("compliance_criteria.id 가 숫자 문자열(\"3\")이어도 number 로 강제해 matched_criteria 와 조인 가능하게 한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          keyword_definitions: [
            { keyword: "협업", compliance_criteria: [{ id: "3", criterion: "역할 분담" }] },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].complianceCriteria[0].id).toBe(3)
  })

  it("improvement_guide 의 알맹이 없는 빈 항목은 걸러낸다(빈 카드 방지)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          improvement_guide: {
            information_enhancement: [
              { target: "협업 경험", missing: "구체 성과" },
              { target: "", missing: "", how_to_add: "", reason: "", priority: "" },
              "",
            ],
            experience_expansion: [{}, { gap_description: "리더십 공백" }],
            keyword_specific_recommendations: [
              { keyword: "", recommendations: [] },
              { keyword: "협업", recommendations: [{ title: "팀 프로젝트" }] },
            ],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.improvementGuide.informationEnhancement).toHaveLength(1)
    expect(res.improvementGuide.experienceExpansion).toHaveLength(1)
    expect(res.improvementGuide.keywordSpecificRecommendations).toHaveLength(1)
  })

  it("key_quotes 를 객체 배열로 파싱한다 (문자열 폴백 포함)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          storylines: [
            {
              keyword: "협업",
              key_quotes: [{ career_title: "A", quote: "인용1" }, "인용2"],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.storylines[0].keyQuotes).toEqual([
      { careerTitle: "A", quote: "인용1" },
      { careerTitle: "", quote: "인용2" },
    ])
  })

  it("improvement_guide 의 overall_direction·구조화·중첩 추천을 파싱한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          improvement_guide: {
            overall_direction: { priority_keyword: "협업", short_term: "st" },
            information_enhancement: [
              { target: "경험1", missing: "m", how_to_add: "h", reason: "r", priority: "높음" },
            ],
            keyword_specific_recommendations: [
              {
                keyword: "협업",
                recommendations: [{ type: "확장", title: "활동", expected_effect: "효과" }],
              },
            ],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.improvementGuide.overallDirection?.priorityKeyword).toBe("협업")
    expect(res.improvementGuide.informationEnhancement[0]).toMatchObject({
      target: "경험1",
      howToAdd: "h",
      priority: "높음",
    })
    expect(res.improvementGuide.keywordSpecificRecommendations[0].recommendations[0]).toEqual({
      type: "확장",
      title: "활동",
      expectedEffect: "효과",
    })
  })

  it("구버전 keyword_specific_recommendations({keyword,description})도 흡수한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          improvement_guide: {
            keyword_specific_recommendations: [{ keyword: "협업", description: "구버전 설명" }],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.improvementGuide.keywordSpecificRecommendations[0].recommendations).toEqual([
      { type: "", title: "구버전 설명", expectedEffect: "" },
    ])
    expect(res.improvementGuide.overallDirection).toBeNull()
  })
})

describe("schema_version 가드 — 부재 ≠ 미상 (FRT-123 계약 §3.5)", () => {
  it("모르는 버전이 명시되면 UnsupportedSchemaError 를 던진다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", keywords: [], result: { schema_version: "keyword/9.9" } }),
    )
    await expect(getKeywordResult("kw-1")).rejects.toBeInstanceOf(UnsupportedSchemaError)
  })

  it("schema_version 부재(구 백엔드)면 던지지 않고 렌더한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", keywords: [], result: {} }),
    )
    await expect(getKeywordResult("kw-1")).resolves.toMatchObject({ id: "kw-1" })
  })

  it("아는 버전이면 정상 렌더한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { schema_version: "comprehensive/1.0" } }),
    )
    await expect(getComprehensiveResult("comp-1")).resolves.toMatchObject({ id: "comp-1" })
  })

  it("flat 응답(result 래퍼 없음)의 최상위 schema_version 도 검사한다", async () => {
    // 매퍼가 flat 형태를 지원하므로 schema_version 이 최상위에 오는 경우도 방어해야 한다.
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", schema_version: "keyword/9.9", keywords: [] }),
    )
    await expect(getKeywordResult("kw-1")).rejects.toBeInstanceOf(UnsupportedSchemaError)
  })
})

describe("updateAnalysisMeta — 타입별 PATCH 경로 (FRT-123 계약 §2)", () => {
  it("comprehensive → PATCH /analysis/comprehensive/{id}", async () => {
    apiMock.patch.mockResolvedValue(undefined)
    await updateAnalysisMeta("comp-1", "comprehensive", { title: "새 이름" })
    expect(apiMock.patch).toHaveBeenCalledWith("/analysis/comprehensive/comp-1", {
      title: "새 이름",
    })
  })

  it("keyword → PATCH /analysis/keyword/{id}", async () => {
    apiMock.patch.mockResolvedValue(undefined)
    await updateAnalysisMeta("kw-1", "keyword", { title: "새 이름" })
    expect(apiMock.patch).toHaveBeenCalledWith("/analysis/keyword/kw-1", {
      title: "새 이름",
    })
  })

  it("individual 은 이름 수정 대상이 아니므로 throw (PATCH 미호출)", async () => {
    await expect(
      updateAnalysisMeta("ind-1", "individual", { title: "x" }),
    ).rejects.toThrow()
    expect(apiMock.patch).not.toHaveBeenCalled()
  })
})

describe("getIndividualAnalysisResult — result 래퍼 내 is_bookmarked 보존 (FRT-64 P2)", () => {
  it("is_bookmarked:true 가 result 래퍼 안에 있어도 isBookmarked:true 로 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-2",
        status: "completed",
        experience_id: "e1",
        result: { is_bookmarked: true },
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-2")
    expect(res.isBookmarked).toBe(true)
  })
})

describe("getComprehensiveResult — result 래퍼 내 is_bookmarked 보존 (FRT-64 P2)", () => {
  it("is_bookmarked:true 가 result 래퍼 안에 있어도 isBookmarked:true 로 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "comp-2",
        status: "completed",
        result: { is_bookmarked: true },
      }),
    )
    const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-2")
    expect(res.isBookmarked).toBe(true)
  })
})

describe("getKeywordResult — result 래퍼 내 is_bookmarked 보존 (FRT-64 P2)", () => {
  it("is_bookmarked:true 가 result 래퍼 안에 있어도 isBookmarked:true 로 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-2",
        status: "completed",
        result: { is_bookmarked: true, keywords: [] },
      }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-2")
    expect(res.isBookmarked).toBe(true)
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiSuccessResponse } from "@/types/api"
import type {
  AnalysisType,
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
  getAnalysisHistory,
  getAnalysisHomeSummary,
  getBookmarks,
  getIndividualAnalysisList,
  getIndividualAnalysisResult,
  getComprehensiveResult,
  getComprehensiveList,
  getKeywordResult,
  retryComprehensiveAnalysis,
  retryKeywordAnalysis,
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

describe("키워드 이중중첩 언랩 — internal.py result 누락 방어 (dual-compat)", () => {
  // 백엔드 internal.py 가 keyword 결과만 상위 result 언랩을 빠뜨려
  // { careers, result: { A-F }, status } 형태로 한 겹 더 감싸 보낼 수 있다(계약 §3 미반영).
  // 한 겹만 벗기면 A_* 를 못 뚫어 화면이 백지가 된다 → 본문이 나올 때까지 result 를 벗긴다.
  it("이중중첩(result.result)에서 A_* 본문을 뚫어 읽는다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          careers: ["백엔드"],
          status: "completed",
          result: {
            A_keyword_definitions: [{ keyword: "리더십", definition: "d", synonyms: [] }],
            C_coverage: [{ keyword: "리더십", related_count: 2, total_count: 5 }],
            D_matched_experiences: [{ keyword: "리더십", experiences: [] }],
            E_storylines: [{ keyword: "리더십" }],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].keyword).toBe("리더십")
    expect(res.coverage[0].relatedCount).toBe(2)
    expect(res.matchedExperiences[0].keyword).toBe("리더십")
    expect(res.storylines[0].keyword).toBe("리더십")
  })

  it("이중중첩이어도 바깥 껍질의 메타(keywords·target)를 보존한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          keywords: ["리더십", "협업"],
          target: "스타트업 PM",
          result: {
            A_keyword_definitions: [{ keyword: "리더십", definition: "d", synonyms: [] }],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywords).toEqual(["리더십", "협업"])
    expect(res.targetScenario).toBe("스타트업 PM")
    expect(res.keywordDefinitions[0].keyword).toBe("리더십")
  })

  it("단일중첩(정상 계약)은 그대로 읽는다 — 회귀 없음", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          A_keyword_definitions: [{ keyword: "리더십", definition: "d", synonyms: [] }],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywordDefinitions[0].keyword).toBe("리더십")
  })

  it("단일중첩이면서 result 옆에 메타(keywords·target)가 있으면 보존한다 (codex P2)", async () => {
    // 신형 응답은 result 껍질 옆에 keywords·target 을 함께 실어 보낸다. 첫 언랩이 result 로
    // 통째 교체하면 이 메타가 사라져 헤더가 generic 이 되고 타깃 시나리오가 누락된다.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        keywords: ["리더십", "협업"],
        target: "스타트업 PM",
        result: {
          A_keyword_definitions: [{ keyword: "리더십", definition: "d", synonyms: [] }],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.keywords).toEqual(["리더십", "협업"])
    expect(res.targetScenario).toBe("스타트업 PM")
    expect(res.keywordDefinitions[0].keyword).toBe("리더십")
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

  it("구버전 keyword_specific_recommendations 의 text/content/suggestion/reason 도 흡수한다 (codex P2)", async () => {
    // 구 coerceImprovementText 는 description 외에 text/content/suggestion/reason 까지 폴백했다.
    // 이 브랜치가 description/recommendation 만 보면 { keyword, text } 형태가 빈 카드가 된다.
    const cases: Array<[string, Record<string, unknown>]> = [
      ["텍스트 폴백", { keyword: "협업", text: "텍스트 폴백" }],
      ["콘텐츠 폴백", { keyword: "협업", content: "콘텐츠 폴백" }],
      ["제안 폴백", { keyword: "협업", suggestion: "제안 폴백" }],
      ["이유 폴백", { keyword: "협업", reason: "이유 폴백" }],
    ]
    for (const [expected, item] of cases) {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "kw-1",
          status: "completed",
          result: {
            improvement_guide: { keyword_specific_recommendations: [item] },
          },
        }),
      )
      const res = await getKeywordResult("kw-1")
      expect(res.improvementGuide.keywordSpecificRecommendations[0].recommendations).toEqual([
        { type: "", title: expected, expectedEffect: "" },
      ])
    }
  })

  it("relevance=low 인데 is_reference_only 플래그가 없으면 참고용으로 파생한다 (codex P2)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          matched_experiences: [
            {
              keyword: "협업",
              experiences: [
                { career_title: "저신뢰", relevance: "low" },
                { career_title: "고신뢰", relevance: "high" },
                { career_title: "명시false", relevance: "low", is_reference_only: false },
              ],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    const exps = res.matchedExperiences[0].experiences
    expect(exps[0].isReferenceOnly).toBe(true) // low + 플래그 없음 → 파생
    expect(exps[1].isReferenceOnly).toBe(false) // high → 아님
    expect(exps[2].isReferenceOnly).toBe(false) // 명시 false 는 존중
  })

  it("레거시 객체형 guide 텍스트({description}/{text}/{suggestion})를 보존한다 (codex P2)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          improvement_guide: {
            information_enhancement: [{ description: "구버전 정보보강" }],
            experience_expansion: [{ suggestion: "구버전 경험확장" }],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    // 빈값으로 걸러지지 않고 텍스트가 대표 필드에 실린다.
    expect(res.improvementGuide.informationEnhancement).toHaveLength(1)
    expect(res.improvementGuide.informationEnhancement[0].howToAdd).toBe("구버전 정보보강")
    expect(res.improvementGuide.experienceExpansion).toHaveLength(1)
    expect(res.improvementGuide.experienceExpansion[0].gapDescription).toBe("구버전 경험확장")
  })

  it("레거시 guide 텍스트가 {content}/{recommendation} 로 와도 보존한다 (codex P2 2차)", async () => {
    // 제거된 coerceImprovementText 가 받던 content·recommendation 도 형제 매퍼(keyword_specific)와
    // 동일하게 흡수해야 한다. 누락 시 정보보강·경험확장 카드가 빈값으로 걸러진다.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          improvement_guide: {
            information_enhancement: [{ content: "content 정보보강" }],
            experience_expansion: [{ recommendation: "recommendation 경험확장" }],
          },
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.improvementGuide.informationEnhancement).toHaveLength(1)
    expect(res.improvementGuide.informationEnhancement[0].howToAdd).toBe("content 정보보강")
    expect(res.improvementGuide.experienceExpansion).toHaveLength(1)
    expect(res.improvementGuide.experienceExpansion[0].gapDescription).toBe("recommendation 경험확장")
  })

  it("C_coverage 카운트 부재 시 matched relevance 로 높음/보통/참고 카운트를 파생한다 (codex P2)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          C_coverage: [{ keyword: "협업", related_count: 3, total_count: 5 }],
          D_matched_experiences: [
            {
              keyword: "협업",
              experiences: [
                { career_title: "a", relevance: "high" },
                { career_title: "b", relevance: "high" },
                { career_title: "c", relevance: "low" },
              ],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.coverage[0]).toMatchObject({ highCount: 2, mediumCount: 0, lowCount: 1 })
  })

  it("C_coverage 가 이미 카운트를 주면 파생으로 덮어쓰지 않는다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          C_coverage: [{ keyword: "협업", high_count: 9, medium_count: 0, low_count: 0 }],
          D_matched_experiences: [
            { keyword: "협업", experiences: [{ career_title: "a", relevance: "low" }] },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    expect(res.coverage[0].highCount).toBe(9) // 백엔드 값 신뢰
    expect(res.coverage[0].lowCount).toBe(0)
  })

  it("C_coverage 가 명시적 {0,0,0} 을 주면 매칭이 있어도 파생으로 덮지 않는다 (codex xhigh)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          // 명시적 0 = 백엔드의 권위 있는 무커버리지 신호. 필드 부재(과도기)와 구분해야 한다.
          C_coverage: [{ keyword: "협업", high_count: 0, medium_count: 0, low_count: 0 }],
          D_matched_experiences: [
            { keyword: "협업", experiences: [{ career_title: "a", relevance: "high" }] },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    // 파생(highCount:1)으로 덮지 않고 명시적 0 을 그대로 신뢰한다.
    expect(res.coverage[0].highCount).toBe(0)
    expect(res.coverage[0].mediumCount).toBe(0)
    expect(res.coverage[0].lowCount).toBe(0)
  })

  it("relevance 대소문자가 섞여도(Low/High) 참고용 파생·카운트가 동작한다 (codex xhigh)", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          // 카운트 필드 부재 → 파생. relevance 는 대문자로 온다.
          C_coverage: [{ keyword: "협업", related_count: 2, total_count: 5 }],
          D_matched_experiences: [
            {
              keyword: "협업",
              experiences: [
                { career_title: "a", relevance: "Low" },
                { career_title: "b", relevance: "High" },
              ],
            },
          ],
        },
      }),
    )
    const res = await getKeywordResult("kw-1")
    const exps = res.matchedExperiences[0].experiences
    expect(exps[0].isReferenceOnly).toBe(true) // "Low" → 참고용 파생(대소문자 무관)
    expect(exps[1].isReferenceOnly).toBe(false)
    // 카운트 파생도 대소문자 무관하게 집계한다.
    expect(res.coverage[0]).toMatchObject({ highCount: 1, mediumCount: 0, lowCount: 1 })
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

  it("이중중첩(result.result)의 안쪽 schema_version 도 검사한다", async () => {
    // internal.py 이중중첩 형태(result.result)에서 안쪽 result 가 모르는 버전을 선언하면
    // 언랩 뒤 구 매퍼로 조용히 파싱되지 않도록, 중첩 result 체인 전 층을 검사해 throw 한다.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        keywords: [],
        result: { careers: [], result: { schema_version: "keyword/9.9" } },
      }),
    )
    await expect(getKeywordResult("kw-1")).rejects.toBeInstanceOf(UnsupportedSchemaError)
  })

  it("이중중첩이어도 아는 버전이면 정상 렌더한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        keywords: [],
        result: { careers: [], result: { schema_version: "keyword/4.1", A_keyword_definitions: [] } },
      }),
    )
    await expect(getKeywordResult("kw-1")).resolves.toMatchObject({ id: "kw-1" })
  })

  it("언랩이 도달하는 최대 깊이(result 4겹) 안쪽의 모르는 버전도 검사한다 (codex xhigh)", async () => {
    // 언랩(unwrapKeywordBody)과 가드(assertRenderableSchema)가 같은 상수(MAX_RESULT_NESTING)로
    // 깊이를 파생한다. 언랩이 뚫는 가장 깊은 층까지 schema_version 을 검사하지 않으면
    // 모르는 버전이 검사망을 통과해 구 매퍼로 조용히 파싱된다 → 깊은 중첩도 throw 해야 한다.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        keywords: [],
        result: { result: { result: { result: { schema_version: "keyword/9.9" } } } },
      }),
    )
    await expect(getKeywordResult("kw-1")).rejects.toBeInstanceOf(UnsupportedSchemaError)
  })

  it("comprehensive/2.0 은 아는 버전이라 안내 대신 정상 렌더한다", async () => {
    // 이 버그의 핵심 재현: 백엔드가 comprehensive/2.0 을 주입하는데 프론트가 1.0 만 알면
    // 상세가 통째로 "표시할 수 없습니다" 안내로 빠졌다. 2.0 을 화이트리스트에 넣어 해소.
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { schema_version: "comprehensive/2.0" } }),
    )
    await expect(getComprehensiveResult("comp-1")).resolves.toMatchObject({ id: "comp-1" })
  })
})

describe("종합 분석 v2.0 매퍼 (comprehensive/2.0)", () => {
  function comp2(result: Record<string, unknown>) {
    return envelope({
      id: "comp-1",
      status: "completed",
      result: { schema_version: "comprehensive/2.0", ...result },
    })
  }

  it("weaknesses.severity 를 critical|major|minor 로 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        critical_diagnosis: {
          weaknesses: [
            { id: 1, severity: "critical", title: "a" },
            { id: 2, severity: "major", title: "b" },
            { id: 3, severity: "minor", title: "c" },
          ],
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.criticalDiagnosis.weaknesses.map((w) => w.severity)).toEqual([
      "critical",
      "major",
      "minor",
    ])
  })

  it("모르는 severity 는 major 로 폴백한다 (약점 과소평가 금지)", async () => {
    apiMock.get.mockResolvedValue(
      comp2({ critical_diagnosis: { weaknesses: [{ id: 1, severity: "high", title: "a" }] } }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.criticalDiagnosis.weaknesses[0].severity).toBe("major")
  })

  it("숫자로 오는 id 를 버리지 않는다 — 계약상 number 라 인덱스 폴백으로 떨어지면 안 된다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        critical_diagnosis: { weaknesses: [{ id: 7, severity: "major", title: "a" }] },
        strength_diagnosis: { strengths: [{ id: 3, level: "strong", title: "b" }] },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.criticalDiagnosis.weaknesses[0].id).toBe("7")
    expect(res.strengthDiagnosis.strengths[0].id).toBe("3")
  })

  it("id 가 아예 없으면 인덱스 폴백으로 키를 보장한다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({ critical_diagnosis: { weaknesses: [{ severity: "major", title: "a" }] } }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.criticalDiagnosis.weaknesses[0].id).toBe("w-0")
  })

  it("additional_recommendations 를 객체 배열로 매핑한다 (문자열 배열로 뭉개지 않음)", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        additional_recommendations: {
          certifications: [
            {
              name: "정보처리기사",
              reason: "r",
              expected_effect: "e",
              estimated_duration: "3개월",
              url: null,
              issuer: "한국산업인력공단",
            },
          ],
          clubs_and_societies: [
            { name: "AUSG", type: "연합동아리", school_affiliation: "한양대", search_verified: true, url: "https://ausg.me" },
          ],
          projects_and_contests: [
            { name: "Kaggle", organizer: "Kaggle", is_regular: true, url: null, deadline: null },
          ],
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const { certifications, clubsAndSocieties, projectsAndContests } =
      res.additionalRecommendations
    expect(certifications[0]).toMatchObject({
      name: "정보처리기사",
      issuer: "한국산업인력공단",
      url: null,
    })
    expect(clubsAndSocieties[0]).toMatchObject({
      name: "AUSG",
      type: "연합동아리",
      schoolAffiliation: "한양대",
      searchVerified: true,
    })
    expect(projectsAndContests[0]).toMatchObject({ name: "Kaggle", isRegular: true, deadline: null })
  })

  it("strength_diagnosis 를 매핑하고 level 을 outstanding|strong|notable 로 읽는다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        strength_diagnosis: {
          one_line_verdict: "강점 요약",
          strengths: [
            {
              id: 1,
              category: "직무_연관성",
              level: "outstanding",
              title: "일관 라인",
              leverage_action: "서사를 앞세우세요",
            },
          ],
          no_strength_diagnosis: { has_issue: false, reason: "", improvement_direction: "" },
          standout_experience_types: ["연구 인턴"],
          content_quality_highlights: [{ item: "i", highlight: "h", why_effective: "w" }],
          competitor_advantage: "차별점",
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.strengthDiagnosis.oneLineVerdict).toBe("강점 요약")
    expect(res.strengthDiagnosis.strengths[0]).toMatchObject({
      level: "outstanding",
      leverageAction: "서사를 앞세우세요",
    })
    expect(res.strengthDiagnosis.contentQualityHighlights[0].whyEffective).toBe("w")
    expect(res.strengthDiagnosis.competitorAdvantage).toBe("차별점")
  })

  it("strength_diagnosis 부재(구 1.0 레코드)에도 빈 구조로 안전하게 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { schema_version: "comprehensive/1.0" } }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.strengthDiagnosis.strengths).toEqual([])
    expect(res.strengthDiagnosis.oneLineVerdict).toBe("")
  })

  it("verified_jobs / expired_jobs 를 분리 매핑하고 is_valid 유무를 보존한다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        verified_jobs: [
          { company: "네이버", role: "ML", deadline: "2026-12-30", why_match: "m", url: "https://x", is_valid: true },
        ],
        expired_jobs: [
          { company: "라인", role: "ML", deadline: "2026-06-30", why_match: "m", url: "https://y" },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.verifiedJobs).toHaveLength(1)
    expect(res.verifiedJobs[0].isValid).toBe(true)
    expect(res.expiredJobs).toHaveLength(1)
    // expired 는 is_valid 키가 없다(백엔드 filter_valid_jobs) — undefined 로 보존.
    expect(res.expiredJobs[0].isValid).toBeUndefined()
  })

  it("구 레코드 valid_job_recommendations 는 verifiedJobs 로 폴백한다", async () => {
    apiMock.get.mockResolvedValue(
      comp2({
        valid_job_recommendations: [
          { company: "카카오", role: "AI", deadline: "상시채용", why_match: "m", url: "https://z" },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.verifiedJobs).toHaveLength(1)
    expect(res.verifiedJobs[0].company).toBe("카카오")
    expect(res.expiredJobs).toEqual([])
  })
})

describe("종합 분석 v3.1 매퍼 (comprehensive/3.1, FRT-208)", () => {
  function comp31(result: Record<string, unknown>) {
    return envelope({
      id: "comp-1",
      status: "completed",
      result: { schema_version: "comprehensive/3.1", ...result },
    })
  }

  /** 이중호환 회귀용 — v3.1 필드가 하나도 없는 현행 백엔드 응답. */
  function comp2v20(result: Record<string, unknown>) {
    return envelope({
      id: "comp-1",
      status: "completed",
      result: { schema_version: "comprehensive/2.0", ...result },
    })
  }

  it("comprehensive/3.1 은 아는 버전이라 안내 대신 정상 렌더한다", async () => {
    // v3.1 명세엔 schema_version 키 자체가 없지만, 백엔드가 관례대로 붙일 수 있다.
    // 화이트리스트에 없으면 상세가 통째로 "표시할 수 없습니다"로 빠진다(PR #196 이 2.0 에서 겪은 실패).
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { schema_version: "comprehensive/3.1" } }),
    )
    await expect(getComprehensiveResult("comp-1")).resolves.toMatchObject({ id: "comp-1" })
  })

  it("comprehensive/3.0 도 미리 허용한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { schema_version: "comprehensive/3.0" } }),
    )
    await expect(getComprehensiveResult("comp-1")).resolves.toMatchObject({ id: "comp-1" })
  })

  // ── star_analysis_status: 부재 ≠ 미생성 ──────────────────
  it("star_analysis_status 가 없는 v2.0 응답은 present:false 다 (없는 안내를 만들지 않는다)", async () => {
    // generated 는 방어 파싱 기본값 false 로 떨어진다. 그걸 "만들지 못했다"로 읽으면
    // v2.0 사용자에게 이유가 빈 안내가 뜬다 — 부재와 미생성을 반드시 구분해야 한다.
    apiMock.get.mockResolvedValue(comp2v20({ resume_star_format: [] }))
    const res = await getComprehensiveResult("comp-1")
    expect(res.starAnalysisStatus.present).toBe(false)
    expect(res.starAnalysisStatus.generated).toBe(false)
  })

  it("star_analysis_status 가 오면 present:true 로 보존한다", async () => {
    apiMock.get.mockResolvedValue(comp31({ star_analysis_status: { generated: true } }))
    const res = await getComprehensiveResult("comp-1")
    expect(res.starAnalysisStatus.present).toBe(true)
    expect(res.starAnalysisStatus.generated).toBe(true)
  })

  it("star_analysis_status 가 배열로 와도 present:false 로 막는다 (배열은 레코드가 아니다)", async () => {
    apiMock.get.mockResolvedValue(comp31({ star_analysis_status: [] }))
    const res = await getComprehensiveResult("comp-1")
    expect(res.starAnalysisStatus.present).toBe(false)
  })

  it("미생성 사유·코칭·폐기 항목을 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        resume_star_format: [],
        star_analysis_status: {
          generated: false,
          reason: "STAR 기준 충족 0건",
          experience_block_count: 3,
          star_eligible_block_count: 0,
          coaching: ["행동을 1인칭으로 적어보세요"],
          rejected_entries: [
            {
              title: "학회 프로젝트",
              reason: "A·R 근거 없음",
              unsupported_slots: ["A", "R"],
              coaching: "무엇을 어떻게 했는지 적어보세요",
            },
          ],
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const s = res.starAnalysisStatus
    expect(s).toMatchObject({
      present: true,
      generated: false,
      reason: "STAR 기준 충족 0건",
      experienceBlockCount: 3,
      starEligibleBlockCount: 0,
      coaching: ["행동을 1인칭으로 적어보세요"],
    })
    expect(s.rejectedEntries[0]).toMatchObject({
      title: "학회 프로젝트",
      reason: "A·R 근거 없음",
      unsupportedSlots: ["A", "R"],
      coaching: "무엇을 어떻게 했는지 적어보세요",
    })
  })

  it("quality_review 는 부재 시 null 이다 (빈 객체로 뭉개지 않는다)", async () => {
    apiMock.get.mockResolvedValue(comp31({ star_analysis_status: { generated: false } }))
    const res = await getComprehensiveResult("comp-1")
    expect(res.starAnalysisStatus.qualityReview).toBeNull()
  })

  it("quality_review 를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        star_analysis_status: {
          generated: true,
          quality_review: {
            evaluated: 2,
            grade_distribution: { A: 1, D: 1 },
            portfolio_verdict: "일부 항목 보완 필요",
            top_fixes: ["Action 비중 — 1/2건에서 미달"],
          },
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.starAnalysisStatus.qualityReview).toEqual({
      evaluated: 2,
      gradeDistribution: { A: 1, D: 1 },
      portfolioVerdict: "일부 항목 보완 필요",
      topFixes: ["Action 비중 — 1/2건에서 미달"],
    })
  })

  // ── hasResultBody: 카운트 0 이 상태 안내를 죽이지 않는다 ──
  it("카운트만 있는 star_analysis_status 는 본문으로 치지 않는다 (FRT-134 안내 보존)", async () => {
    // hasAnyContent 는 숫자를 컨텐츠로 친다(Number.isFinite(0) === true). 마스킹하지 않으면
    // experience_block_count:0 하나 때문에 본문이 텅 빈 결과가 "본문 있음"이 되어
    // AnalysisResultUnavailable 상태 안내가 영영 뜨지 않는다.
    apiMock.get.mockResolvedValue(
      comp31({
        star_analysis_status: {
          generated: false,
          experience_block_count: 0,
          star_eligible_block_count: 0,
          coaching: [],
          rejected_entries: [],
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(false)
  })

  it("미생성 사유가 있으면 본문으로 친다 (화면이 이유를 말할 수 있다)", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        star_analysis_status: { generated: false, reason: "경험 기록이 아직 짧아요" },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(true)
  })

  it("quality_review 도 화면이 그리는 필드만 본문 판정에 넣는다", async () => {
    // evaluated(number)·grade_distribution 은 화면에 그리지 않는데 판정에 넘기면
    // evaluated:0 하나로 카운트와 똑같은 오판이 재현된다(/code-review medium).
    apiMock.get.mockResolvedValue(
      comp31({
        star_analysis_status: {
          generated: false,
          quality_review: {
            evaluated: 0,
            grade_distribution: { A: 0, B: 0, C: 0, D: 0 },
            portfolio_verdict: "",
            top_fixes: [],
          },
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(false)
    // 대조군: 그릴 말이 실제로 있으면 본문으로 친다.
    expect(res.starAnalysisStatus.qualityReview?.evaluated).toBe(0)
  })

  it("총평이 있으면 quality_review 만으로도 본문으로 친다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        star_analysis_status: {
          generated: false,
          quality_review: { evaluated: 0, portfolio_verdict: "조금만 더 다듬으면 좋아요" },
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(true)
  })

  it("guard_version 은 매핑하지 않는다 (본문 판정 오염 금지)", async () => {
    // v3.1 은 guard_version:"v3.1" 을 항상 채운다. 매핑하면 문자열 하나 때문에
    // 본문이 텅 빈 결과가 "본문 있음"이 된다.
    apiMock.get.mockResolvedValue(comp31({ guard_version: "v3.1" }))
    const res = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(false)
    expect(res).not.toHaveProperty("guardVersion")
  })

  // ── STAR 항목 확장 ────────────────────────────────────────
  it("STAR 항목의 headline·L·원문 근거·역량 근거를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        resume_star_format: [
          {
            title: "데이터 파이프라인 구축",
            headline: "수집 자동화로 처리 시간 60% 단축",
            S: "상황",
            S_source_quote: "매주 수작업으로 모았다",
            T: "과제",
            T_source_quote: "자동화가 필요했다",
            A: "행동",
            A_source_quote: "Airflow 로 DAG 를 짰다",
            R: "결과",
            R_source_quote: "4시간이 1.5시간으로 줄었다",
            L: "배움",
            L_source_quote: "관측 가능성이 중요하다는 걸 배웠다",
            competency_evidence: [{ competency: "문제 해결", why: "병목을 직접 찾아 고쳤다" }],
          },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const star = res.resumeStarFormat[0]
    expect(star).toMatchObject({
      title: "데이터 파이프라인 구축",
      headline: "수집 자동화로 처리 시간 60% 단축",
      situation: "상황",
      task: "과제",
      action: "행동",
      result: "결과",
      learning: "배움",
    })
    expect(star.sourceQuotes).toEqual({
      situation: "매주 수작업으로 모았다",
      task: "자동화가 필요했다",
      action: "Airflow 로 DAG 를 짰다",
      result: "4시간이 1.5시간으로 줄었다",
      learning: "관측 가능성이 중요하다는 걸 배웠다",
    })
    expect(star.competencyEvidence).toEqual([
      { competency: "문제 해결", why: "병목을 직접 찾아 고쳤다" },
    ])
  })

  it("근거가 없어 null 로 온 슬롯을 빈 값으로 안전 처리한다", async () => {
    // v3.1 은 근거 없는 슬롯을 null 로 비운다. 화면은 이미 빈 값을 "보완 필요"로 그린다.
    apiMock.get.mockResolvedValue(
      comp31({
        resume_star_format: [
          { title: "t", headline: null, S: null, S_source_quote: null, A: "행동", R: "결과", L: null },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const star = res.resumeStarFormat[0]
    expect(star.headline).toBe("")
    expect(star.situation).toBe("")
    expect(star.learning).toBe("")
    expect(star.sourceQuotes.situation).toBe("")
  })

  it("evidence_status(미충족 슬롯·재배치 판정)를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        resume_star_format: [
          {
            title: "t",
            evidence_status: {
              supported_slots: ["S", "A", "R"],
              unsupported_slots: [
                { slot: "T", label: "과제", reason: "원문에 없음", claimed_quote: "" },
              ],
              restructuring_only: true,
              restructuring_detail: ["S↔T (82% 중복)"],
            },
            quality_warning: "입력 문장을 슬롯별로 재배치한 수준입니다",
          },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const star = res.resumeStarFormat[0]
    expect(star.evidenceStatus).toEqual({
      supportedSlots: ["S", "A", "R"],
      unsupportedSlots: [{ slot: "T", label: "과제", reason: "원문에 없음", claimedQuote: "" }],
      restructuringOnly: true,
      restructuringDetail: ["S↔T (82% 중복)"],
    })
    expect(star.qualityWarning).toBe("입력 문장을 슬롯별로 재배치한 수준입니다")
  })

  it("quality(등급·점수·총평·루브릭·우선 개선점)를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        resume_star_format: [
          {
            title: "t",
            quality: {
              grade: "B",
              score: "7/10",
              verdict: "골격은 좋습니다",
              criteria: [
                {
                  key: "action_dominant",
                  label: "Action 비중",
                  passed: false,
                  detail: "Action 이 전체의 12%",
                  coaching: "행동 서술을 늘려보세요",
                },
              ],
              priority_fixes: ["행동 서술을 늘려보세요"],
              derived_field_notes: ["headline 삭제: 원문에 없는 수치"],
            },
          },
        ],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    const q = res.resumeStarFormat[0].quality
    expect(q).toMatchObject({
      grade: "B",
      score: "7/10",
      verdict: "골격은 좋습니다",
      priorityFixes: ["행동 서술을 늘려보세요"],
      derivedFieldNotes: ["headline 삭제: 원문에 없는 수치"],
    })
    expect(q.criteria[0]).toEqual({
      key: "action_dominant",
      label: "Action 비중",
      passed: false,
      detail: "Action 이 전체의 12%",
      coaching: "행동 서술을 늘려보세요",
    })
  })

  it("모르는 grade 는 null 이다 (임의로 낮게 잡지 않는다)", async () => {
    apiMock.get.mockResolvedValue(
      comp31({ resume_star_format: [{ title: "t", quality: { grade: "F", score: "1/10" } }] }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.resumeStarFormat[0].quality.grade).toBeNull()
  })

  it("quality 가 아예 없는 v2.0 항목도 등급 null 로 안전 처리한다", async () => {
    apiMock.get.mockResolvedValue(
      comp2v20({ resume_star_format: [{ title: "t", S: "s", T: "t", A: "a", R: "r" }] }),
    )
    const res = await getComprehensiveResult("comp-1")
    const star = res.resumeStarFormat[0]
    // v2.0 필드는 그대로 살아 있고, v3.1 필드만 빈 값이다 — 화면이 v2.0 과 동일하게 그려진다.
    expect(star).toMatchObject({ title: "t", situation: "s", task: "t", action: "a", result: "r" })
    expect(star.quality.grade).toBeNull()
    expect(star.headline).toBe("")
    expect(star.competencyEvidence).toEqual([])
    expect(star.evidenceStatus.supportedSlots).toEqual([])
  })

  // ── 그 밖의 v3.1 신규 필드 ────────────────────────────────
  it("clubs_and_societies 의 url_note 를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({
        additional_recommendations: {
          clubs_and_societies: [
            { name: "AUSG", url: null, url_note: "직접 확인하십시오: AUSG 연합동아리" },
          ],
        },
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.additionalRecommendations.clubsAndSocieties[0].urlNote).toBe(
      "직접 확인하십시오: AUSG 연합동아리",
    )
  })

  it("recommendation_notices 를 매핑한다", async () => {
    apiMock.get.mockResolvedValue(
      comp31({ recommendation_notices: ["확실한 자격증을 찾지 못해 추천하지 않았습니다"] }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.recommendationNotices).toEqual([
      "확실한 자격증을 찾지 못해 추천하지 않았습니다",
    ])
  })

  it("recommendation_notices 부재 시 빈 배열이다", async () => {
    apiMock.get.mockResolvedValue(comp2v20({}))
    const res = await getComprehensiveResult("comp-1")
    expect(res.recommendationNotices).toEqual([])
  })

  it("v3.1 이 삭제한 v2.0 필드(expired_jobs)는 계속 읽는다 (백엔드 미배포 하위호환)", async () => {
    apiMock.get.mockResolvedValue(
      comp2v20({
        expired_jobs: [{ company: "라인", role: "ML", deadline: "2026-06-30", url: "https://y" }],
      }),
    )
    const res = await getComprehensiveResult("comp-1")
    expect(res.expiredJobs).toHaveLength(1)
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

describe("retry — 실패 분석 재실행 (FRT-108 / BAC-42)", () => {
  it("종합 재시도는 타입별 retry 경로로 POST 한다", async () => {
    apiMock.post.mockResolvedValue(envelope({ id: "comp-1", title: "제목" }))
    await retryComprehensiveAnalysis("comp-1")
    expect(apiMock.post).toHaveBeenCalledWith("/analysis/comprehensive/comp-1/retry")
  })

  it("키워드 재시도는 타입별 retry 경로로 POST 한다", async () => {
    apiMock.post.mockResolvedValue(envelope({ id: "kw-1", title: "제목" }))
    await retryKeywordAnalysis("kw-1")
    expect(apiMock.post).toHaveBeenCalledWith("/analysis/keyword/kw-1/retry")
  })

  it("body 를 보내지 않는다 — 원 파라미터는 서버 보관값을 재사용한다", async () => {
    apiMock.post.mockResolvedValue(envelope({}))
    await retryComprehensiveAnalysis("comp-1")
    await retryKeywordAnalysis("kw-1")
    // 두 번째 인자(body)가 붙으면 삭제된 경험 때문에 400 이 나는 경로가 생긴다.
    for (const call of apiMock.post.mock.calls) {
      expect(call).toHaveLength(1)
    }
  })

  it("에러는 삼키지 않고 그대로 throw 한다 (409 = 실패 상태가 아님)", async () => {
    const conflict = new Error("409")
    apiMock.post.mockRejectedValue(conflict)
    await expect(retryComprehensiveAnalysis("comp-1")).rejects.toBe(conflict)
    await expect(retryKeywordAnalysis("kw-1")).rejects.toBe(conflict)
  })
})

describe("hasResultBody — 본문 부재 판정 (FRT-134)", () => {
  // 실재하는 트리거는 result:null 이다. 백엔드 계약이 `dict | None` 이라 진행 중·실패인
  // 동안 result 가 계속 null 이고, 그동안 언랩은 엔벨로프로 폴백해 전 필드를 빈 값으로
  // 만든다 — 상세 화면의 섹션 가드가 전부 걸려 헤더만 남은 빈 화면이 됐다.
  const emptyBodies: [string, unknown][] = [
    ["null (진행 중·실패)", null],
    ["빈 배열", []],
    ["빈 객체", {}],
    ["값 없는 키만", { itemName: "", briefSummary: "", synergyRecommendations: [] }],
  ]

  describe("개별 분석", () => {
    it.each(emptyBodies)("result: %s → hasResultBody false", async (_label, result) => {
      apiMock.get.mockResolvedValue(
        envelope({ id: "ind-1", status: "processing", experience_id: "e1", result }),
      )
      const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
      expect(res.hasResultBody).toBe(false)
    })

    it("엔벨로프 status 가 result.status 로 폴백돼도 본문으로 세지 않는다", async () => {
      // mapIndividualDetail 은 result.status 를 `body.status ?? r.status` 로 채운다.
      // 이걸 판정에 넣으면 본문이 통째로 없어도 status 하나 때문에 "본문 있음"이 된다.
      apiMock.get.mockResolvedValue(
        envelope({ id: "ind-1", status: "failed", experience_id: "e1", result: null }),
      )
      const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
      expect(res.result.status).toBe("failed")
      expect(res.hasResultBody).toBe(false)
    })

    it("본문이 한 필드라도 차 있으면 true", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "ind-1",
          status: "completed",
          experience_id: "e1",
          result: { brief_summary: "요약" },
        }),
      )
      const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
      expect(res.hasResultBody).toBe(true)
    })

    it("result 래퍼 없는 flat 응답도 본문으로 인정한다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({ id: "ind-1", status: "completed", experience_id: "e1", item_name: "프로젝트" }),
      )
      const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
      expect(res.hasResultBody).toBe(true)
    })
  })

  describe("종합 분석", () => {
    it.each(emptyBodies)("result: %s → hasResultBody false", async (_label, result) => {
      apiMock.get.mockResolvedValue(envelope({ id: "comp-1", status: "processing", result }))
      const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
      expect(res.hasResultBody).toBe(false)
    })

    it("경험 참조만 있고 본문이 없으면 false — experiences 는 result 밖 엔벨로프다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "comp-1",
          status: "processing",
          experiences: [{ id: "e1", title: "부스트캠프" }],
          result: null,
        }),
      )
      const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
      expect(res.experiences).toHaveLength(1)
      expect(res.hasResultBody).toBe(false)
    })

    it("본문이 한 필드라도 차 있으면 true", async () => {
      apiMock.get.mockResolvedValue(
        envelope({ id: "comp-1", status: "completed", result: { brief_summary: "요약" } }),
      )
      const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
      expect(res.hasResultBody).toBe(true)
    })
  })

  describe("키워드 분석", () => {
    it.each(emptyBodies)("result: %s → hasResultBody false", async (_label, result) => {
      apiMock.get.mockResolvedValue(envelope({ id: "kw-1", status: "processing", result }))
      const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
      expect(res.hasResultBody).toBe(false)
    })

    it("껍질 메타(keywords·target)만 있으면 false — 본문 없이도 실려 온다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "kw-1",
          status: "processing",
          result: { keywords: ["리더십"], target: "스타트업 PM" },
        }),
      )
      const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
      expect(res.keywords).toEqual(["리더십"])
      expect(res.hasResultBody).toBe(false)
    })

    it("본문 키가 있어도 값이 비면 false — 화면은 여전히 비어 있다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({ id: "kw-1", status: "completed", result: { A_keyword_definitions: [] } }),
      )
      const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
      expect(res.hasResultBody).toBe(false)
    })

    it("본문(A~F)이 차 있으면 true", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "kw-1",
          status: "completed",
          result: {
            A_keyword_definitions: [{ keyword: "리더십", definition: "정의" }],
          },
        }),
      )
      const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
      expect(res.hasResultBody).toBe(true)
    })
  })

  it("내용 있는 배열 result 도 본문으로 세지 않는다", async () => {
    // 빈 배열뿐 아니라 원소가 있는 배열도 마찬가지다 — 매퍼가 읽는 키가 하나도 없으므로
    // 화면에 그릴 값이 없다. 배열을 레코드로 캐스팅하는 경로(typeof [] === "object")가
    // 형태 불일치를 오류가 아니라 빈 값으로 번역하는 것을 여기서 막는다.
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", result: ["a", "b"] }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemName).toBe("")
    expect(res.hasResultBody).toBe(false)
  })
})

describe("hasResultBody — 알맹이 없는 원소 (FRT-134 codex P2)", () => {
  it("개별: resume/star 처럼 기본값이 없는 배열은 [{}] 도 본문이 아니다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: { star_format: {}, synergy_recommendations: [] },
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.hasResultBody).toBe(false)
  })

  it("종합: resume_star_format: [{}] 는 본문이 아니다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "comp-1", status: "completed", result: { resume_star_format: [{}] } }),
    )
    const res: ComprehensiveAnalysisResult = await getComprehensiveResult("comp-1")
    expect(res.hasResultBody).toBe(false)
  })

  it("키워드: A_keyword_definitions: [{}] 는 본문이 아니다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "kw-1", status: "completed", result: { A_keyword_definitions: [{}] } }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
    expect(res.hasResultBody).toBe(false)
  })

  it("기본 enum 이 붙는 매퍼(시너지)는 [{}] 도 본문으로 센다 — 화면이 실제로 카드를 그린다", async () => {
    // 판정 기준은 "화면이 그릴 값이 있는가"다. SynergySection 은 items.length 만 보므로
    // 빈 원소여도 '보통' 배지가 달린 카드를 그린다 — 안내 화면으로 보내면 오히려 어긋난다.
    // 알맹이 없는 카드 자체를 거르는 건 이 판정이 아니라 매퍼의 필터가 할 일이다.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: { synergy_recommendations: [{}] },
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.synergyRecommendations[0].priority).toBe("medium")
    expect(res.hasResultBody).toBe(true)
  })
})

describe("키워드 이중중첩 언랩 — 빈 껍질을 뚫는다 (FRT-134 codex P2)", () => {
  it("중간 래퍼에 빈 A~F 키가 섞여도 안쪽 본문을 잃지 않는다", async () => {
    // 종료 조건이 "키 존재"였을 때는 빈 A_keyword_definitions 하나 때문에 언랩이 멈춰
    // 안쪽 E_storylines 를 통째로 잃었다 — 결과가 있는데 화면이 비는 최악의 조합.
    apiMock.get.mockResolvedValue(
      envelope({
        id: "kw-1",
        status: "completed",
        result: {
          A_keyword_definitions: [],
          result: {
            E_storylines: [{ storyline_title: "협업으로 병목을 걷어낸 경험" }],
          },
        },
      }),
    )
    const res: KeywordAnalysisResult = await getKeywordResult("kw-1")
    expect(res.storylines).toHaveLength(1)
    expect(res.hasResultBody).toBe(true)
  })
})

// FRT-170: `/analysis/history` 엔드포인트가 없어 세 목록을 병합한다. 그 중 일부만 실패하면
// 살아남은 소스만으로 정렬된 목록이 "전체 기록"인 얼굴로 표시돼, 사용자는 특정 유형의 기록이
// 삭제됐다고 오인한다. 회복력(한 소스가 죽어도 나머지는 보여준다)은 그대로 두고,
// **무엇을 못 불러왔는지**를 반환값에 실어 화면이 말할 수 있게 한다.
describe("getAnalysisHistory — 부분 실패 보고 (FRT-170)", () => {
  /** 목록 3종을 URL 로 갈라, 지정한 유형만 reject 시킨다. */
  function stubLists(failing: AnalysisType[]) {
    const byUrl: Record<string, AnalysisType> = {
      "/analysis/individual": "individual",
      "/analysis/comprehensive": "comprehensive",
      "/analysis/keyword": "keyword",
    }
    apiMock.get.mockImplementation((url: string) => {
      const type = byUrl[url]
      if (type === undefined) throw new Error(`unexpected url: ${url}`)
      if (failing.includes(type)) return Promise.reject(new Error("boom"))
      return Promise.resolve(
        envelope([{ id: `${type}-1`, status: "success", created_at: "2026-07-27" }]),
      ) as never
    })
  }

  it("종합만 실패하면 나머지는 보여주되 실패한 유형을 함께 돌려준다", async () => {
    stubLists(["comprehensive"])

    const { items, failedTypes } = await getAnalysisHistory()

    expect(failedTypes).toEqual(["comprehensive"])
    expect(items.map((s) => s.id)).toEqual(["individual-1", "keyword-1"])
  })

  it("실패 유형의 순서는 선언 순서로 고정된다 — reject 순서에 흔들리지 않는다", async () => {
    // push 순서로 모으면 어느 요청이 먼저 깨지느냐에 따라 안내 문구가 뒤바뀐다.
    stubLists(["individual", "keyword"])

    const { items, failedTypes } = await getAnalysisHistory()

    expect(failedTypes).toEqual(["individual", "keyword"])
    expect(items.map((s) => s.id)).toEqual(["comprehensive-1"])
  })

  it("전부 성공하면 실패 목록은 비어 있다", async () => {
    stubLists([])

    const { failedTypes } = await getAnalysisHistory()

    expect(failedTypes).toEqual([])
  })

  it("전부 실패하면 기존대로 에러를 던진다 — 화면은 전체 실패로 전환된다", async () => {
    stubLists(["individual", "comprehensive", "keyword"])

    await expect(getAnalysisHistory()).rejects.toThrow("분석 기록을 불러올 수 없습니다.")
  })

  it("유형 필터가 걸려도 실패 보고는 그대로 실린다", async () => {
    // 필터는 병합 뒤 적용된다 — 필터로 걸러진 결과가 비어도 그 원인이 실패인지
    // 정말 없는 것인지 화면이 구분할 수 있어야 한다.
    stubLists(["comprehensive"])

    const { items, failedTypes } = await getAnalysisHistory({ type: "comprehensive" })

    expect(failedTypes).toEqual(["comprehensive"])
    expect(items).toEqual([])
  })
})

// FRT-169: 분석 홈 요약도 같은 병합 구조다. 다만 여기엔 **경험 목록**이라는 네 번째 소스와
// 그 넷에서 파생되는 통계(분석 완료 수·최근 분석 시각·전체 경험 수)가 있다. 부분 실패를
// 무음으로 흡수하면 목록이 비는 데 그치지 않고 **숫자가 과소집계된 값을 확신 있게** 말한다.
describe("getAnalysisHomeSummary — 부분 실패 보고 (FRT-169)", () => {
  const EXPERIENCES_URL = "/experiences/"

  /** 분석 3종 + 경험 목록을 URL 로 갈라, 지정한 것만 reject 시킨다. */
  function stubSummary(failing: (AnalysisType | "experiences")[]) {
    const byUrl: Record<string, AnalysisType | "experiences"> = {
      "/analysis/individual": "individual",
      "/analysis/comprehensive": "comprehensive",
      "/analysis/keyword": "keyword",
      [EXPERIENCES_URL]: "experiences",
    }
    apiMock.get.mockImplementation((url: string) => {
      const source = byUrl[url]
      if (source === undefined) throw new Error(`unexpected url: ${url}`)
      if (failing.includes(source)) return Promise.reject(new Error("boom"))
      if (source === "experiences")
        return Promise.resolve(envelope({ count: 7, contents: [] })) as never
      return Promise.resolve(
        envelope([{ id: `${source}-1`, status: "success", created_at: "2026-07-27" }]),
      ) as never
    })
  }

  it("키워드만 실패하면 나머지는 살아남고 실패한 유형만 실린다", async () => {
    stubSummary(["keyword"])

    const summary = await getAnalysisHomeSummary()

    expect(summary.failedTypes).toEqual(["keyword"])
    expect(summary.experiencesFailed).toBe(false)
    expect(summary.recentIndividual.map((s) => s.id)).toEqual(["individual-1"])
    expect(summary.recentKeyword).toEqual([])
  })

  it("경험 목록만 실패하면 분석 유형은 멀쩡하고 경험 실패만 따로 보고된다", async () => {
    // 경험 목록은 AnalysisType 이 아니다 — failedTypes 에 섞으면 없는 "경험 탭"이 생긴다.
    stubSummary(["experiences"])

    const summary = await getAnalysisHomeSummary()

    expect(summary.failedTypes).toEqual([])
    expect(summary.experiencesFailed).toBe(true)
    expect(summary.stats.totalExperiences).toBe(0)
    expect(summary.stats.analysisCompleted).toBe(3)
  })

  it("실패 유형의 순서는 선언 순서로 고정된다 — reject 순서에 흔들리지 않는다", async () => {
    stubSummary(["keyword", "individual"])

    const summary = await getAnalysisHomeSummary()

    expect(summary.failedTypes).toEqual(["individual", "keyword"])
  })

  it("분석 3종이 전부 실패해도 경험 목록이 살아 있으면 던지지 않는다 — 기존 경계 보존", async () => {
    // 기존 코드의 throw 조건은 `failCount === 4`(경험까지 포함한 전멸)였다.
    // 셋만 실패하는 경우를 새로 던지게 만들면 그건 버그 수정이 아니라 동작 변경이다.
    stubSummary(["individual", "comprehensive", "keyword"])

    const summary = await getAnalysisHomeSummary()

    expect(summary.failedTypes).toEqual(["individual", "comprehensive", "keyword"])
    expect(summary.experiencesFailed).toBe(false)
    expect(summary.stats.totalExperiences).toBe(7)
    expect(summary.stats.analysisCompleted).toBe(0)
  })

  it("경험 목록까지 전부 실패하면 기존대로 에러를 던진다", async () => {
    stubSummary(["individual", "comprehensive", "keyword", "experiences"])

    await expect(getAnalysisHomeSummary()).rejects.toThrow(
      "분석 데이터를 불러올 수 없습니다.",
    )
  })

  it("전부 성공하면 실패 보고는 비어 있다", async () => {
    stubSummary([])

    const summary = await getAnalysisHomeSummary()

    expect(summary.failedTypes).toEqual([])
    expect(summary.experiencesFailed).toBe(false)
    expect(summary.stats.analysisCompleted).toBe(3)
    expect(summary.stats.totalExperiences).toBe(7)
  })
})

describe("분석 본문의 원시 필드 표기 정제 (FRT-316)", () => {
  const resultWith = (weakness: Record<string, unknown>) => ({
    itemName: "",
    itemType: "",
    briefSummary: "",
    deepAnalysis: {},
    starFormat: {},
    itemDiagnosis: { weaknesses: [weakness] },
    synergyRecommendations: [],
    actionPlan: {},
    missingInfoWarning: "",
  })

  it("`근거` 자리에 온 tags 배열 표기를 사람이 읽는 문장으로 낸다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: resultWith({
          id: 1,
          title: "산업 직무 연결성",
          evidence: 'tags: ["미술사", "소논문", "17세기 스페인 회화", "무리요"]',
        }),
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemDiagnosis.weaknesses[0].evidence).toBe(
      "태그: 미술사, 소논문, 17세기 스페인 회화, 무리요",
    )
  })

  it("fields 안정키와 기간 객체 표기도 매핑을 지나며 정제된다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: resultWith({
          id: 2,
          title: "연구 기간의 짧음",
          evidence: 'research-paper.연구 기간: {"start": "2024-10", "end": "2024-12"}',
        }),
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemDiagnosis.weaknesses[0].evidence).toBe("연구 기간: 2024-10 ~ 2024-12")
  })

  it("배열형 서술(누락된 요소)도 원소 단위로 정제된다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: {
          itemName: "",
          itemType: "",
          briefSummary: "",
          deepAnalysis: {},
          starFormat: {},
          itemDiagnosis: { missingElements: ['tags: ["미술사"]', "정량적 성과가 없습니다."] },
          synergyRecommendations: [],
          actionPlan: {},
          missingInfoWarning: "",
        },
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemDiagnosis.missingElements).toEqual([
      "태그: 미술사",
      "정량적 성과가 없습니다.",
    ])
  })

  it("정상 서술 문장은 매핑을 지나도 그대로다", async () => {
    const sentence = "근거: 지원 직무와의 연결고리가 드러나지 않습니다."
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: resultWith({ id: 3, title: "연결성", evidence: sentence }),
      }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemDiagnosis.weaknesses[0].evidence).toBe(sentence)
  })
})

describe("스냅샷 배열의 원소 타입 검증 (FRT-215)", () => {
  it("selectedKeywords 에 문자열 아닌 값이 섞여도 화면까지 흘려보내지 않는다", async () => {
    apiMock.get.mockResolvedValue(
      envelope([
        {
          id: "a1",
          status: "success",
          selected_keywords: ["데이터 분석", 1, null, "기획"],
          selected_experience_ids: [
            "e1",
            2,
            "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
            "e3",
          ],
        },
      ]),
    )
    const list = await getIndividualAnalysisList()
    expect(list[0].selectedKeywords).toEqual(["데이터 분석", "기획"])
    // id 는 원문 그대로여야 한다 — 정제기가 식별자를 건드리면 이후 경험 조회 매칭이 깨진다.
    expect(list[0].selectedExperienceIds).toEqual([
      "e1",
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      "e3",
    ])
  })
})

// ─── FRT-271 ────────────────────────────────────────────────
// 백엔드(arc-backend `ai_analyst/src/ai/individual.py`)가 실제로 보내는 값 중 세 갈래가
// 화면에 도달하지 못했다. 여기서 고정하는 것은 "매퍼가 백엔드가 두는 자리에서 읽는가"다.
// 응답 본문은 analyzer 가 만든 JSON 이 DB(JSONB)를 거쳐 무변형 통과한 것이라, 프롬프트의
// 출력 스키마가 곧 프런트가 받는 모양이다(app/src/api/analysis.py — result: dict[str, Any]).
describe("개별분석 — 백엔드가 보내는데 화면에 안 닿던 값들 (FRT-271)", () => {
  const bodyWith = (extra: Record<string, unknown>) => ({
    item_name: "뉴스 감성 분석 프로젝트",
    item_type: "프로젝트",
    brief_summary: "",
    deep_analysis: { career_value: "", market_value: "" },
    star_format: {},
    item_diagnosis: {},
    synergy_recommendations: [],
    action_plan: {},
    missing_info_warning: "",
    ...extra,
  })

  const fetchDetail = async (extra: Record<string, unknown>) => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", result: bodyWith(extra) }),
    )
    const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
    return res
  }

  describe("applicable_roles 는 deep_analysis 밖 최상위에 온다", () => {
    it("최상위 snake_case 를 읽는다 — 회귀 시 항상 빈 배열이었다", async () => {
      const res = await fetchDetail({ applicable_roles: ["데이터 분석가", "ML 엔지니어"] })
      expect(res.result.deepAnalysis.applicableRoles).toEqual(["데이터 분석가", "ML 엔지니어"])
    })

    it("최상위 camelCase 도 읽는다", async () => {
      const res = await fetchDetail({ applicableRoles: ["PM"] })
      expect(res.result.deepAnalysis.applicableRoles).toEqual(["PM"])
    })

    // 백엔드 프롬프트에서 이 한 줄만 들여쓰기가 어긋나 있어(individual.py, deep_analysis 를
    // 닫은 뒤인데 4칸 들여쓰기) 모델이 deep_analysis 안에 넣어 보내는 경우가 실재할 수 있다.
    // 기존 경로를 폴백으로 남긴다.
    it("구 경로(deep_analysis 안)에 와도 계속 읽는다", async () => {
      const res = await fetchDetail({
        deep_analysis: { career_value: "", market_value: "", applicable_roles: ["기획자"] },
      })
      expect(res.result.deepAnalysis.applicableRoles).toEqual(["기획자"])
    })

    // `??` 만 쓰면 최상위가 빈 배열로 "명시돼" 올 때 중첩에 담긴 값이 가려진다.
    it("최상위가 빈 배열이면 중첩에 담긴 값을 살린다", async () => {
      const res = await fetchDetail({
        applicable_roles: [],
        deep_analysis: { career_value: "", market_value: "", applicable_roles: ["리서처"] },
      })
      expect(res.result.deepAnalysis.applicableRoles).toEqual(["리서처"])
    })

    it("어느 쪽에도 없으면 빈 배열이다", async () => {
      const res = await fetchDetail({})
      expect(res.result.deepAnalysis.applicableRoles).toEqual([])
    })
  })

  describe("item_strengths 를 읽는다", () => {
    const itemStrengths = {
      has_genuine_strengths: true,
      one_line_strength_verdict: "데이터 파이프라인을 혼자 끝까지 세운 경험이 핵심이다.",
      no_strength_reason: null,
      summarized_strengths: ["수집~시각화 전 구간 단독 구현", "정량 성과 명시"],
      strengths: [
        {
          id: 1,
          category: "전문성_희소성",
          strength_level: "outstanding",
          title: "단독 파이프라인",
          analysis: "수집·전처리·모델링·시각화를 한 사람이 이었다.",
          evidence: "크롤러부터 대시보드까지 직접 구현했다고 기록돼 있다.",
          career_impact: "주니어 단계에서 보기 드문 전 구간 이해도를 증명한다.",
          leverage_action: "파이프라인 구조도를 한 장으로 정리해 포트폴리오 첫 장에 배치하라.",
          showcase_example: "Before: 감성 분석을 했다 → After: 일 1만건 수집~대시보드까지 단독 구축",
        },
        {
          id: 2,
          category: "성과_입증",
          strength_level: "moderate",
          title: "정량 성과",
          analysis: "정확도 수치가 남아 있다.",
          evidence: "F1 0.82",
          career_impact: "설득력을 높인다.",
          leverage_action: "비교 기준선을 함께 적어라.",
          showcase_example: null,
        },
      ],
      strongest_asset: "전 구간을 혼자 이어본 경험",
      positioning_tip: "면접에서 '왜 그 설계를 골랐나'로 이야기를 열어라.",
    }

    it("최상위 item_strengths 전체를 매핑한다 — 회귀 시 섹션이 통째로 없었다", async () => {
      const res = await fetchDetail({ item_strengths: itemStrengths })
      const s = res.result.itemStrengths

      expect(s.hasGenuineStrengths).toBe(true)
      expect(s.oneLineVerdict).toBe("데이터 파이프라인을 혼자 끝까지 세운 경험이 핵심이다.")
      expect(s.summarizedStrengths).toEqual(["수집~시각화 전 구간 단독 구현", "정량 성과 명시"])
      expect(s.strongestAsset).toBe("전 구간을 혼자 이어본 경험")
      expect(s.positioningTip).toBe("면접에서 '왜 그 설계를 골랐나'로 이야기를 열어라.")
      expect(s.strengths).toHaveLength(2)
      expect(s.strengths[0]).toMatchObject({
        id: "1",
        category: "전문성_희소성",
        level: "outstanding",
        title: "단독 파이프라인",
        analysis: "수집·전처리·모델링·시각화를 한 사람이 이었다.",
        evidence: "크롤러부터 대시보드까지 직접 구현했다고 기록돼 있다.",
        careerImpact: "주니어 단계에서 보기 드문 전 구간 이해도를 증명한다.",
        leverageAction: "파이프라인 구조도를 한 장으로 정리해 포트폴리오 첫 장에 배치하라.",
      })
      expect(s.strengths[0].showcaseExample).toContain("After:")
      // null 은 빈 문자열로 떨어져 화면이 조용히 건너뛴다.
      expect(s.strengths[1].showcaseExample).toBe("")
      expect(s.noStrengthReason).toBe("")
    })

    // ⚠️ 종합분석의 level 어휘는 outstanding|strong|notable, 개별은 outstanding|notable|moderate 다.
    // 한 판별기로 합치면 moderate 가 "모르는 값"이 되어 조용히 notable 로 승격된다.
    it("moderate 를 notable 로 승격하지 않는다", async () => {
      const res = await fetchDetail({
        item_strengths: { strengths: [{ id: 1, strength_level: "moderate" }] },
      })
      expect(res.result.itemStrengths.strengths[0].level).toBe("moderate")
    })

    it("개별분석에 없는 어휘(strong)·미상값은 가장 낮은 등급으로 떨어뜨린다 — 강점 인플레이션 금지", async () => {
      const res = await fetchDetail({
        item_strengths: {
          strengths: [{ id: 1, strength_level: "strong" }, { id: 2, strength_level: null }],
        },
      })
      expect(res.result.itemStrengths.strengths[0].level).toBe("moderate")
      expect(res.result.itemStrengths.strengths[1].level).toBe("moderate")
    })

    it("강점 없음 응답은 사유를 살려 내려보낸다", async () => {
      const res = await fetchDetail({
        item_strengths: {
          has_genuine_strengths: false,
          strengths: [],
          no_strength_reason: "기간·역할·성과가 모두 비어 강점을 판단할 수 없다.",
          one_line_strength_verdict: null,
        },
      })
      const s = res.result.itemStrengths
      expect(s.hasGenuineStrengths).toBe(false)
      expect(s.strengths).toEqual([])
      expect(s.noStrengthReason).toBe("기간·역할·성과가 모두 비어 강점을 판단할 수 없다.")
    })

    it("item_strengths 부재(구 레코드)여도 빈 구조를 돌려 화면이 안전히 건너뛴다", async () => {
      const res = await fetchDetail({})
      expect(res.result.itemStrengths.strengths).toEqual([])
      expect(res.result.itemStrengths.hasGenuineStrengths).toBe(false)
      expect(res.result.itemStrengths.oneLineVerdict).toBe("")
    })

    // has_genuine_strengths 는 boolean 이라 hasAnyContent 가 컨텐츠로 세지 않는다.
    // 세기 시작하면 본문이 통째로 없어도 "본문 있음"이 된다(FRT-134 회귀).
    it("강점 플래그만 true 인 빈 본문을 '본문 있음'으로 오판하지 않는다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "ind-1",
          status: "processing",
          experience_id: "e1",
          result: {
            item_name: "",
            item_type: "",
            brief_summary: "",
            deep_analysis: {},
            star_format: {},
            item_diagnosis: {},
            item_strengths: { has_genuine_strengths: true, strengths: [] },
            synergy_recommendations: [],
            action_plan: {},
            missing_info_warning: "",
          },
        }),
      )
      const res: IndividualAnalysisResult = await getIndividualAnalysisResult("ind-1")
      expect(res.hasResultBody).toBe(false)
    })

    it("강점 서술에 섞여 온 원시 필드 표기도 정제된다 (FRT-316 과 같은 그물)", async () => {
      const res = await fetchDetail({
        item_strengths: {
          summarized_strengths: ['tags: ["미술사", "소논문"]'],
          strengths: [{ id: 1, evidence: 'tags: ["미술사", "소논문"]' }],
        },
      })
      expect(res.result.itemStrengths.summarizedStrengths).toEqual(["태그: 미술사, 소논문"])
      expect(res.result.itemStrengths.strengths[0].evidence).toBe("태그: 미술사, 소논문")
    })
  })

  describe("limitations 는 item_diagnosis 안에 온다", () => {
    it("item_diagnosis.limitations 를 읽는다 — 회귀 시 '한계' 블록이 늘 비었다", async () => {
      const res = await fetchDetail({
        item_diagnosis: { limitations: ["기간이 3주로 짧다", "팀 규모가 적혀 있지 않다"] },
      })
      expect(res.result.itemDiagnosis.limitations).toEqual([
        "기간이 3주로 짧다",
        "팀 규모가 적혀 있지 않다",
      ])
    })

    it("부재 시 빈 배열이다", async () => {
      const res = await fetchDetail({})
      expect(res.result.itemDiagnosis.limitations).toEqual([])
    })
  })
})

// ─── 개별분석 스키마 v1.0 → v1.2 ────────────────────────────
// 백엔드가 v1.2 에서 후처리(`postprocess_result` / `normalize_time_fields`)를 붙이면서
// 두 가지가 달라졌다. 여기서 고정하는 것은 "두 형태가 한 매퍼를 통과하는가"다.
//   1. action_plan 의 각 칸이 문자열 → { 기간, 마감일, 내용 } 객체
//   2. applicable_roles 가 최상위 → deep_analysis 안 (위 FRT-271 블록이 이미 양쪽을 덮는다)
// v1.0 형태는 이미 저장된 레코드로 계속 살아 있으므로 하위호환을 함께 못 박는다.
describe("개별분석 스키마 v1.2", () => {
  const bodyWith = (extra: Record<string, unknown>) => ({
    item_name: "데이터 분석 인턴",
    item_type: "인턴십",
    brief_summary: "",
    deep_analysis: { career_value: "", market_value: "" },
    star_format: {},
    item_diagnosis: {},
    synergy_recommendations: [],
    action_plan: {},
    missing_info_warning: "",
    ...extra,
  })

  const fetchDetail = async (extra: Record<string, unknown>) => {
    apiMock.get.mockResolvedValue(
      envelope({ id: "ind-1", status: "completed", experience_id: "e1", result: bodyWith(extra) }),
    )
    return getIndividualAnalysisResult("ind-1")
  }

  describe("action_plan — 문자열(v1.0)에서 객체(v1.2)로", () => {
    it("v1.2 객체의 내용·기간·마감일을 읽는다", async () => {
      const res = await fetchDetail({
        action_plan: {
          단기: { 기간: "2026-08-31 ~ 2026-11-30", 마감일: "2026-11-30", 내용: "SQL 포트폴리오 정리" },
          중기: { 기간: "2026-11-30 ~ 2027-08-31", 마감일: "2027-08-31", 내용: "실무 프로젝트 1건" },
          장기: { 기간: "2027-08-31 ~ 2029-08-31", 마감일: "2029-08-31", 내용: "데이터 직무 전환" },
        },
      })
      expect(res.result.actionPlan.shortTerm).toEqual({
        period: "2026-08-31 ~ 2026-11-30",
        deadline: "2026-11-30",
        content: "SQL 포트폴리오 정리",
      })
      expect(res.result.actionPlan.midTerm.content).toBe("실무 프로젝트 1건")
      expect(res.result.actionPlan.longTerm.deadline).toBe("2029-08-31")
    })

    // v1.0 레코드는 DB 에 그대로 남아 있다. 문자열이 오면 그 자체가 내용이다.
    it("v1.0 문자열이 오면 내용으로 읽고 기간·마감일은 비운다", async () => {
      const res = await fetchDetail({
        action_plan: { 단기: "3개월 이내 SQL 학습", 중기: "6개월~1년", 장기: "1년 이상" },
      })
      expect(res.result.actionPlan.shortTerm).toEqual({
        period: "",
        deadline: "",
        content: "3개월 이내 SQL 학습",
      })
      expect(res.result.actionPlan.longTerm.content).toBe("1년 이상")
    })

    // 백엔드는 모델이 칸을 못 채우면 내용을 null 로 둔다(normalize_time_fields).
    // 기간·마감일만 남은 칸을 "행동이 있다"고 그리면 빈 카드가 된다.
    it("내용이 null 이면 기간·마감일이 있어도 내용은 빈 문자열이다", async () => {
      const res = await fetchDetail({
        action_plan: { 단기: { 기간: "2026-08-31 ~ 2026-11-30", 마감일: "2026-11-30", 내용: null } },
      })
      expect(res.result.actionPlan.shortTerm.content).toBe("")
      expect(res.result.actionPlan.shortTerm.deadline).toBe("2026-11-30")
    })

    it("action_plan 자체가 없으면 세 칸 모두 빈 값이다", async () => {
      const res = await fetchDetail({})
      expect(res.result.actionPlan.shortTerm).toEqual({ period: "", deadline: "", content: "" })
      expect(res.result.actionPlan.midTerm.content).toBe("")
    })
  })

  describe("star_note — STAR 를 못 만든 이유", () => {
    it("star_note 를 읽는다", async () => {
      const res = await fetchDetail({
        star_note: "기간·성과 수치가 없어 STAR 로 정리하기 어려워요.",
      })
      expect(res.result.starNote).toBe("기간·성과 수치가 없어 STAR 로 정리하기 어려워요.")
    })

    // 충분히 채워졌으면 백엔드가 null 을 보낸다 — 부재는 빈 문자열이다.
    it("null 이면 빈 문자열이다", async () => {
      const res = await fetchDetail({ star_note: null })
      expect(res.result.starNote).toBe("")
    })
  })

  describe("removed_recommendations — 검증에서 걸러낸 추천", () => {
    it("이름·분류·사유를 읽는다", async () => {
      const res = await fetchDetail({
        removed_recommendations: [
          { name: "사회분석사", category: "자격증", removed_reason: "실재하지 않는 자격증명" },
        ],
      })
      expect(res.result.removedRecommendations).toEqual([
        { name: "사회분석사", category: "자격증", removedReason: "실재하지 않는 자격증명" },
      ])
    })

    // 제거된 항목이 없으면 백엔드는 배열이 아니라 null 을 보낸다(`removed or None`).
    it("null 이면 빈 배열이다", async () => {
      const res = await fetchDetail({ removed_recommendations: null })
      expect(res.result.removedRecommendations).toEqual([])
    })
  })

  // 화이트리스트에 없으면 상세가 통째로 "표시할 수 없습니다"로 빠진다(계약 §3.5).
  it("schema_version individual/1.2 가 명시돼도 렌더한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: { ...bodyWith({}), schema_version: "individual/1.2" },
      }),
    )
    const res = await getIndividualAnalysisResult("ind-1")
    expect(res.result.itemName).toBe("데이터 분석 인턴")
  })

  // 검증되지 않은 중간 버전을 화이트리스트에 미리 열면 게이트 자체가 무의미해진다.
  // 1.2 는 보고서와 백엔드 원본으로 형태를 확인했지만 1.1 은 실물을 본 적이 없다 —
  // 모양이 다르면 매퍼가 필드를 조용히 흘리므로, "표시할 수 없습니다"가 옳은 결말이다.
  it("schema_version individual/1.1 은 확인된 적이 없어 거부한다", async () => {
    apiMock.get.mockResolvedValue(
      envelope({
        id: "ind-1",
        status: "completed",
        experience_id: "e1",
        result: { ...bodyWith({}), schema_version: "individual/1.1" },
      }),
    )
    await expect(getIndividualAnalysisResult("ind-1")).rejects.toBeInstanceOf(
      UnsupportedSchemaError,
    )
  })

  // ── 기간·마감일만 남은 칸이 "본문 있음"을 만들지 않는다 (FRT-134 계열) ──
  // normalize_time_fields() 는 내용을 못 채워도 기간·마감일을 **무조건** 씌운다. 그 두 문자열을
  // 판정에 넣으면 그릴 것이 하나도 없는 결과가 "본문 있음"이 되어, 화면은 상태 안내 대신
  // 텅 빈 완료 껍데기를 그린다. ActionPlanSection 이 내용 없는 칸을 빼는 기준과 같아야 한다.
  describe("hasResultBody — 내용 없는 액션 플랜 칸", () => {
    const emptyBody = {
      item_name: "",
      item_type: "",
      brief_summary: "",
      deep_analysis: { career_value: "", market_value: "" },
      star_format: {},
      item_diagnosis: {},
      synergy_recommendations: [],
      missing_info_warning: "",
    }

    const fetchEmpty = async (actionPlan: unknown) => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "ind-1",
          status: "completed",
          experience_id: "e1",
          result: { ...emptyBody, action_plan: actionPlan },
        }),
      )
      return getIndividualAnalysisResult("ind-1")
    }

    it("내용이 null 이고 기간·마감일만 있으면 본문 없음이다", async () => {
      const res = await fetchEmpty({
        단기: { 기간: "2026-08-31 ~ 2026-11-30", 마감일: "2026-11-30", 내용: null },
        중기: { 기간: "2026-11-30 ~ 2027-08-31", 마감일: "2027-08-31", 내용: null },
        장기: { 기간: "2027-08-31 ~ 2029-08-31", 마감일: "2029-08-31", 내용: null },
      })
      expect(res.hasResultBody).toBe(false)
    })

    it("한 칸이라도 내용이 있으면 본문 있음이다", async () => {
      const res = await fetchEmpty({
        단기: { 기간: "2026-08-31 ~ 2026-11-30", 마감일: "2026-11-30", 내용: "SQL 포트폴리오 정리" },
        중기: { 기간: "2026-11-30 ~ 2027-08-31", 마감일: "2027-08-31", 내용: null },
        장기: { 기간: "2027-08-31 ~ 2029-08-31", 마감일: "2029-08-31", 내용: null },
      })
      expect(res.hasResultBody).toBe(true)
    })

    // 추천이 전부 걸러져도 화면은 그 사실을 안내한다 — 그릴 말이 남아 있으므로 본문이다.
    it("걸러낸 추천만 남아도 본문 있음이다", async () => {
      apiMock.get.mockResolvedValue(
        envelope({
          id: "ind-1",
          status: "completed",
          experience_id: "e1",
          result: {
            ...emptyBody,
            action_plan: {},
            removed_recommendations: [
              { name: "사회분석사", category: "자격증", removed_reason: "실재하지 않는 자격증" },
            ],
          },
        }),
      )
      const res = await getIndividualAnalysisResult("ind-1")
      expect(res.hasResultBody).toBe(true)
    })
  })
})

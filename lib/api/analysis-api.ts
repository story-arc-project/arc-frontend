import { api } from "./client";
import { getExperiences } from "./experience-api";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AnalysisHomeSummary,
  AnalysisSnapshot,
  AnalysisType,
  AnalysisStatus,
  IndividualAnalysisResult,
  ComprehensiveAnalysisResult,
  KeywordAnalysisResult,
  KeywordSuggestion,
  BookmarkedSnapshot,
  SelectableExperience,
  ConfidenceLevel,
} from "@/types/analysis";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

async function mock<T>(loader: () => Promise<T>): Promise<T> {
  // simulate network delay
  await new Promise((r) => setTimeout(r, 300));
  return loader();
}

function mocks() {
  return import("./mocks/analysis");
}

// ─── Defensive DTO parsing ──────────────────────────────────
// 백엔드 응답 구조가 프런트 리치 타입과 완전히 일치한다는 보장이 없다.
// 얕은 매퍼로 누락 필드에 안전 기본값을 채우고, 최상위 형태만 맞춘다.

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asConfidence(value: unknown): ConfidenceLevel {
  return value === "sufficient" || value === "partial" || value === "insufficient"
    ? value
    : "partial";
}

function mapStatus(value: unknown): AnalysisStatus {
  // 백엔드 스펙: "pending" | "queued" | "success" | "failed"
  // 프런트 enum: "pending" | "processing" | "completed" | "failed"
  if (value === "queued") return "processing";
  if (value === "success") return "completed";
  if (
    value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "pending";
}

function asAnalysisType(value: unknown, fallback: AnalysisType = "individual"): AnalysisType {
  return value === "individual" || value === "comprehensive" || value === "keyword"
    ? value
    : fallback;
}

/** 목록 응답이 `T[]` 혹은 `{ items: T[] }` / `{ contents: T[] }` 형태 어느 쪽이든 수용한다. */
function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const rec = asRecord(value);
  if (Array.isArray(rec.items)) return rec.items as T[];
  if (Array.isArray(rec.contents)) return rec.contents as T[];
  if (Array.isArray(rec.data)) return rec.data as T[];
  return [];
}

function mapSnapshot(
  dto: unknown,
  fallbackType: AnalysisType = "individual",
): AnalysisSnapshot {
  const r = asRecord(dto);
  const experienceIdsRaw =
    r.selectedExperienceIds ?? r.selected_experience_ids ?? r.experience_ids;
  const singleExperienceId = r.experience_id ?? r.experienceId;
  const keywordsRaw = r.selectedKeywords ?? r.selected_keywords ?? r.keywords;
  return {
    id: asString(r.id),
    type: asAnalysisType(r.type, fallbackType),
    title: asString(r.title),
    status: mapStatus(r.status),
    createdAt: asString(r.createdAt ?? r.created_at),
    experienceCount: asNumber(r.experienceCount ?? r.experience_count),
    summaryText: asString(r.summaryText ?? r.summary_text ?? r.analysis_summary),
    overallConfidence: asConfidence(r.overallConfidence ?? r.overall_confidence),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked),
    selectedExperienceIds: Array.isArray(experienceIdsRaw)
      ? (experienceIdsRaw as string[])
      : typeof singleExperienceId === "string" && singleExperienceId
        ? [singleExperienceId]
        : undefined,
    selectedKeywords: Array.isArray(keywordsRaw)
      ? (keywordsRaw as string[])
      : undefined,
  };
}

function mapBookmark(dto: unknown): BookmarkedSnapshot {
  const snapshot = mapSnapshot(dto);
  const r = asRecord(dto);
  return {
    ...snapshot,
    isBookmarked: true,
    bookmarkedAt: asString(r.bookmarkedAt ?? r.bookmarked_at ?? snapshot.createdAt),
  };
}

/**
 * detail 응답은 리치 타입과 완전히 일치한다는 보장이 없다.
 * 프런트에서 사용하는 최상위 필드만 강제로 채우고, 중첩 섹션은 배열 기본값으로 방어한다.
 */
function mapIndividualDetail(dto: unknown): IndividualAnalysisResult {
  const r = asRecord(dto);
  const result = asRecord(r.result);
  return {
    id: asString(r.id),
    experienceId: asString(r.experienceId ?? r.experience_id),
    experienceTitle: asString(r.experienceTitle ?? r.experience_title),
    experienceType: asString(r.experienceType ?? r.experience_type),
    analyzedAt: asString(r.analyzedAt ?? r.analyzed_at ?? r.created_at),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked),
    overallConfidence: asConfidence(r.overallConfidence ?? r.overall_confidence),
    summary: asString(r.summary ?? r.analysis_summary ?? result.summary),
    incidents: asArray(r.incidents) as IndividualAnalysisResult["incidents"],
    roleInterpretations: asArray(
      r.roleInterpretations ?? r.role_interpretations,
    ) as IndividualAnalysisResult["roleInterpretations"],
    keywords: asArray(r.keywords) as IndividualAnalysisResult["keywords"],
    starSummaries: asArray(
      r.starSummaries ?? r.star_summaries,
    ) as IndividualAnalysisResult["starSummaries"],
    recommendations: asArray(r.recommendations) as IndividualAnalysisResult["recommendations"],
    improvementGuides: asArray(
      r.improvementGuides ?? r.improvement_guides,
    ) as IndividualAnalysisResult["improvementGuides"],
    reusableExpressions: asArray(
      r.reusableExpressions ?? r.reusable_expressions,
    ) as IndividualAnalysisResult["reusableExpressions"],
    relatedExperiences: asArray(
      r.relatedExperiences ?? r.related_experiences,
    ) as IndividualAnalysisResult["relatedExperiences"],
  };
}

function mapComprehensiveDetail(dto: unknown): ComprehensiveAnalysisResult {
  const r = asRecord(dto);
  const confidenceGuide = asRecord(r.confidenceGuide ?? r.confidence_guide);
  return {
    id: asString(r.id),
    title: asString(r.title),
    analyzedAt: asString(r.analyzedAt ?? r.analyzed_at ?? r.created_at),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked),
    overallConfidence: asConfidence(r.overallConfidence ?? r.overall_confidence),
    selectedExperienceIds: asArray<string>(
      r.selectedExperienceIds ?? r.selected_experience_ids ?? r.experience_ids,
    ),
    experienceSummaries: asArray(
      r.experienceSummaries ?? r.experience_summaries,
    ) as ComprehensiveAnalysisResult["experienceSummaries"],
    keywords: asArray(r.keywords) as ComprehensiveAnalysisResult["keywords"],
    connections: asArray(r.connections) as ComprehensiveAnalysisResult["connections"],
    storylines: asArray(r.storylines) as ComprehensiveAnalysisResult["storylines"],
    scenarios: asArray(r.scenarios) as ComprehensiveAnalysisResult["scenarios"],
    commonRecommendations: asArray(
      r.commonRecommendations ?? r.common_recommendations,
    ) as ComprehensiveAnalysisResult["commonRecommendations"],
    scenarioRecommendations: asArray(
      r.scenarioRecommendations ?? r.scenario_recommendations,
    ) as ComprehensiveAnalysisResult["scenarioRecommendations"],
    confidenceGuide: {
      overallConfidence: asConfidence(
        confidenceGuide.overallConfidence ?? confidenceGuide.overall_confidence,
      ),
      improvementGuides: asArray(
        confidenceGuide.improvementGuides ?? confidenceGuide.improvement_guides,
      ) as ComprehensiveAnalysisResult["confidenceGuide"]["improvementGuides"],
    },
  };
}

function mapKeywordDetail(dto: unknown): KeywordAnalysisResult {
  const r = asRecord(dto);
  return {
    id: asString(r.id),
    title: asString(r.title),
    analyzedAt: asString(r.analyzedAt ?? r.analyzed_at ?? r.created_at),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked),
    overallConfidence: asConfidence(r.overallConfidence ?? r.overall_confidence),
    selectedKeywords: asArray<string>(
      r.selectedKeywords ?? r.selected_keywords ?? r.keywords,
    ),
    keywordDefinitions: asArray(
      r.keywordDefinitions ?? r.keyword_definitions,
    ) as KeywordAnalysisResult["keywordDefinitions"],
    selectionCriteria: asString(r.selectionCriteria ?? r.selection_criteria),
    coverage: asArray(r.coverage) as KeywordAnalysisResult["coverage"],
    matchedExperiences: asArray(
      r.matchedExperiences ?? r.matched_experiences,
    ) as KeywordAnalysisResult["matchedExperiences"],
    storylines: asArray(r.storylines) as KeywordAnalysisResult["storylines"],
    fitEvaluations: asArray(
      r.fitEvaluations ?? r.fit_evaluations,
    ) as KeywordAnalysisResult["fitEvaluations"],
    improvementGuides: asArray(
      r.improvementGuides ?? r.improvement_guides,
    ) as KeywordAnalysisResult["improvementGuides"],
    commonRecommendations: asArray(
      r.commonRecommendations ?? r.common_recommendations,
    ) as KeywordAnalysisResult["commonRecommendations"],
    keywordRecommendations: asArray(
      r.keywordRecommendations ?? r.keyword_recommendations,
    ) as KeywordAnalysisResult["keywordRecommendations"],
  };
}

// ─── Individual ─────────────────────────────────────────────

export async function getIndividualAnalysisList(params?: {
  status?: string;
}): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockIndividualAnalysisList } = await mocks();
      if (params?.status && params.status !== "all")
        return mockIndividualAnalysisList.filter((s) => s.status === params.status);
      return mockIndividualAnalysisList;
    });
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/individual");
  const items = unwrapList(res.data).map((dto) => mapSnapshot(dto, "individual")).filter((s) => s.id);
  if (params?.status && params.status !== "all") {
    return items.filter((s) => s.status === params.status);
  }
  return items;
}

export async function getIndividualAnalysisResult(
  analysisId: string,
): Promise<IndividualAnalysisResult> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockIndividualAnalysisResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/individual/${analysisId}`,
  );
  return mapIndividualDetail(res.data);
}

// ─── Comprehensive ──────────────────────────────────────────

export async function getComprehensiveList(): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockComprehensiveList);
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/comprehensive");
  return unwrapList(res.data).map((dto) => mapSnapshot(dto, "comprehensive")).filter((s) => s.id);
}

/**
 * POST /analysis/comprehensive
 * body: `{ experiences: string[] }`
 *
 * 백엔드 스펙상 응답은 `{ status, message }`만 반환하고 id 는 포함되지 않는다.
 * 호출부가 후속 폴링을 위해 id 를 필요로 하므로, 서버가 id 를 확장 포함할 때만
 * 해당 값을 사용하고 부재 시 에러를 던진다.
 */
export async function createComprehensiveAnalysis(
  experienceIds: string[],
): Promise<{ analysisId: string }> {
  if (USE_MOCK)
    return mock(async () => ({ analysisId: "comp-new-" + Date.now() }));
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/analysis/comprehensive",
    { experiences: experienceIds },
  );
  const data = asRecord(res.data);
  const analysisId = asString(data.id ?? data.analysisId ?? data.analysis_id);
  if (!analysisId) {
    throw new Error("분석 생성 응답에서 ID를 찾을 수 없습니다.");
  }
  return { analysisId };
}

export async function getComprehensiveResult(
  analysisId: string,
): Promise<ComprehensiveAnalysisResult> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockComprehensiveResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/comprehensive/${analysisId}`,
  );
  return mapComprehensiveDetail(res.data);
}

export async function deleteComprehensiveAnalysis(
  analysisId: string,
): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  await api.delete<void>(`/analysis/comprehensive/${analysisId}`);
}

export async function getAnalysisStatus(
  analysisId: string,
): Promise<{ status: AnalysisStatus }> {
  if (USE_MOCK) return mock(async () => ({ status: "completed" as const }));
  return api.get<{ status: AnalysisStatus }>(`/analysis/status/${analysisId}`);
}

// ─── Keyword ────────────────────────────────────────────────

/**
 * 키워드 추천은 백엔드 스펙 미정. 일단 빈 배열 stub.
 * TODO: 서버 스펙 확정 시 실제 엔드포인트로 연결.
 */
export async function getKeywordSuggestions(): Promise<KeywordSuggestion[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordSuggestions);
  return [];
}

export async function getKeywordList(): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordList);
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/keyword");
  return unwrapList(res.data).map((dto) => mapSnapshot(dto, "keyword")).filter((s) => s.id);
}

/**
 * POST /analysis/keyword
 * body: `{ keywords: string[] }`
 *
 * 백엔드 스펙상 응답은 `{ status, message }`만 반환하고 id 는 포함되지 않는다.
 * 호출부가 후속 폴링을 위해 id 를 필요로 하므로, 서버가 id 를 확장 포함할 때만
 * 해당 값을 사용하고 부재 시 에러를 던진다.
 */
export async function createKeywordAnalysis(
  keywordLabels: string[],
): Promise<{ analysisId: string }> {
  if (USE_MOCK)
    return mock(async () => ({ analysisId: "kw-new-" + Date.now() }));
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/analysis/keyword",
    { keywords: keywordLabels },
  );
  const data = asRecord(res.data);
  const analysisId = asString(data.id ?? data.analysisId ?? data.analysis_id);
  if (!analysisId) {
    throw new Error("분석 생성 응답에서 ID를 찾을 수 없습니다.");
  }
  return { analysisId };
}

export async function getKeywordResult(
  analysisId: string,
): Promise<KeywordAnalysisResult> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/keyword/${analysisId}`,
  );
  return mapKeywordDetail(res.data);
}

export async function deleteKeywordAnalysis(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  await api.delete<void>(`/analysis/keyword/${analysisId}`);
}

// ─── Bookmarks ──────────────────────────────────────────────

export async function getBookmarks(params?: {
  type?: string;
}): Promise<BookmarkedSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockBookmarks } = await mocks();
      if (params?.type && params.type !== "all")
        return mockBookmarks.filter((b) => b.type === params.type);
      return mockBookmarks;
    });
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/bookmarks");
  const items = unwrapList(res.data).map(mapBookmark);
  if (params?.type && params.type !== "all") {
    return items.filter((b) => b.type === params.type);
  }
  return items;
}

/** POST /analysis/bookmarks/:id — body 없음 */
export async function addBookmark(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  await api.post<void>(`/analysis/bookmarks/${analysisId}`);
}

export async function removeBookmark(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  await api.delete<void>(`/analysis/bookmarks/${analysisId}`);
}

// ─── Meta / Delete ──────────────────────────────────────────

/** PATCH /analysis/:id — 제목 변경 등 메타 수정 */
export async function updateAnalysisMeta(
  analysisId: string,
  data: { title: string },
): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  await api.patch<void>(`/analysis/${analysisId}`, data);
}

/**
 * 스펙상 `/analysis/:id` DELETE는 없으므로 타입별 엔드포인트로 분기한다.
 * individual 은 스펙상 삭제 엔드포인트가 없어 에러를 던진다.
 */
export async function deleteAnalysis(
  analysisId: string,
  type: AnalysisType,
): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  if (type === "comprehensive") {
    return deleteComprehensiveAnalysis(analysisId);
  }
  if (type === "keyword") {
    return deleteKeywordAnalysis(analysisId);
  }
  throw new Error("개별 분석은 삭제할 수 없어요.");
}

// ─── Aggregated views (client-side) ─────────────────────────

/**
 * `/analysis/home/summary` 엔드포인트가 없으므로 세 목록을 병렬 fetch 후 집계한다.
 */
export async function getAnalysisHomeSummary(): Promise<AnalysisHomeSummary> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockAnalysisHomeSummary);

  let failCount = 0;
  const safe = <T,>(fallback: T) => (p: Promise<T>): Promise<T> =>
    p.catch(() => { failCount++; return fallback; });

  const [individual, comprehensive, keyword, experiencesData] = await Promise.all([
    safe<AnalysisSnapshot[]>([])(getIndividualAnalysisList()),
    safe<AnalysisSnapshot[]>([])(getComprehensiveList()),
    safe<AnalysisSnapshot[]>([])(getKeywordList()),
    safe({ count: 0, contents: [] as Awaited<ReturnType<typeof getExperiences>>["contents"] })(getExperiences()),
  ]);

  // 모든 요청이 실패하면 에러를 전파한다
  if (failCount === 4) {
    throw new Error("분석 데이터를 불러올 수 없습니다.");
  }

  const all = [...individual, ...comprehensive, ...keyword];
  const completed = all.filter((s) => s.status === "completed");
  const improvementNeeded = completed.filter(
    (s) => s.overallConfidence !== "sufficient",
  ).length;
  const lastAnalysisAt = completed
    .map((s) => s.createdAt)
    .filter(Boolean)
    .sort()
    .pop() ?? "";

  const recentSlice = (items: AnalysisSnapshot[]) =>
    [...items]
      .filter((s) => s.status === "completed")
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 3);

  return {
    stats: {
      totalExperiences: experiencesData.count,
      analysisCompleted: completed.length,
      lastAnalysisAt,
      improvementNeeded,
    },
    recentIndividual: recentSlice(individual),
    recentComprehensive: recentSlice(comprehensive),
    recentKeyword: recentSlice(keyword),
    recommendations: {
      experienceGroups: [],
      suggestedKeywords: [],
    },
  };
}

/**
 * `/analysis/history` 엔드포인트가 없으므로 세 목록을 병합해 반환한다.
 */
export async function getAnalysisHistory(params?: {
  type?: string;
  sort?: "newest" | "oldest";
}): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockHistory } = await mocks();
      let result = [...mockHistory];
      if (params?.type && params.type !== "all")
        result = result.filter((s) => s.type === params.type);
      if (params?.sort === "oldest") result.reverse();
      return result;
    });

  let historyFailCount = 0;
  const safeFetch = (p: Promise<AnalysisSnapshot[]>): Promise<AnalysisSnapshot[]> =>
    p.catch(() => { historyFailCount++; return [] as AnalysisSnapshot[]; });

  const [individual, comprehensive, keyword] = await Promise.all([
    safeFetch(getIndividualAnalysisList()),
    safeFetch(getComprehensiveList()),
    safeFetch(getKeywordList()),
  ]);

  // 모든 요청이 실패하면 에러를 전파한다
  if (historyFailCount === 3) {
    throw new Error("분석 기록을 불러올 수 없습니다.");
  }

  let merged = [...individual, ...comprehensive, ...keyword].filter(
    (s) => s.status === "completed",
  );
  if (params?.type && params.type !== "all") {
    merged = merged.filter((s) => s.type === params.type);
  }
  merged.sort((a, b) => {
    const cmp = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    return params?.sort === "oldest" ? -cmp : cmp;
  });
  return merged;
}

// ─── Selectable Experiences ─────────────────────────────────

/**
 * 전용 엔드포인트가 없으므로 경험 목록 API에서 derive 한다.
 */
export async function getSelectableExperiences(): Promise<SelectableExperience[]> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockSelectableExperiences);

  const data = await getExperiences();
  return data.contents.map((exp) => {
    const content = asRecord(exp.content);
    const title = asString(content.title);
    const status = asString(content.status);
    return {
      id: exp.id,
      title,
      type: exp.type,
      importance: typeof exp.importance === "number" ? exp.importance : 0,
      isComplete: status !== "" && status !== "draft",
    };
  });
}

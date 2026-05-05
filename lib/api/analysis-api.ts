import { api } from "./client";
import { getExperiences } from "./experience-api";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AnalysisHomeSummary,
  AnalysisSnapshot,
  AnalysisType,
  AnalysisStatus,
  IndividualAnalysisResult,
  IndividualAnalysisResultBody,
  IndividualWeakness,
  IndividualSynergyRecommendation,
  IndividualStarFormat,
  IndividualActionPlan,
  WeaknessSeverity,
  SynergyPriority,
  ComprehensiveAnalysisResult,
  ComprehensiveWeakness,
  SynergyCombination,
  ContentQualityIssue,
  JobRecommendation,
  KeywordAnalysisResult,
  KeywordDefinition,
  KeywordCoverage,
  KeywordEvidence,
  MatchedExperience,
  KeywordMatchedGroup,
  KeywordStoryline,
  KeywordSpecificRecommendation,
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

function asWeaknessSeverity(value: unknown): WeaknessSeverity {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function asSynergyPriority(value: unknown): SynergyPriority {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function mapIndividualWeakness(dto: unknown, index: number): IndividualWeakness {
  const r = asRecord(dto);
  return {
    id: asString(r.id, `w-${index}`),
    category: asString(r.category),
    severity: asWeaknessSeverity(r.severity),
    title: asString(r.title),
    diagnosis: asString(r.diagnosis),
    evidence: asString(r.evidence),
    impact: asString(r.impact),
    priorityAction: asString(r.priorityAction ?? r.priority_action),
    improvementExample: asString(r.improvementExample ?? r.improvement_example),
  };
}

function mapComprehensiveWeakness(dto: unknown, index: number): ComprehensiveWeakness {
  const r = asRecord(dto);
  return {
    id: asString(r.id, `w-${index}`),
    category: asString(r.category),
    severity: asWeaknessSeverity(r.severity),
    title: asString(r.title),
    diagnosis: asString(r.diagnosis),
    evidence: asString(r.evidence),
    impact: asString(r.impact),
    priorityAction: asString(r.priorityAction ?? r.priority_action),
  };
}

function mapSynergy(dto: unknown): IndividualSynergyRecommendation {
  const r = asRecord(dto);
  return {
    priority: asSynergyPriority(r.priority),
    category: asString(r.category),
    name: asString(r.name),
    reason: asString(r.reason),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
    estimatedDuration: asString(r.estimatedDuration ?? r.estimated_duration),
  };
}

function mapStarFormat(dto: unknown): IndividualStarFormat {
  const r = asRecord(dto);
  return {
    title: asString(r.title),
    situation: asString(r.situation ?? r.S ?? r.s),
    task: asString(r.task ?? r.T ?? r.t),
    action: asString(r.action ?? r.A ?? r.a),
    result: asString(r.result ?? r.R ?? r.r),
  };
}

/**
 * action_plan 키는 백엔드 표기에 따라 short_term/mid_term/long_term 또는 한글 키일 수 있다.
 */
function mapActionPlan(dto: unknown): IndividualActionPlan {
  const r = asRecord(dto);
  return {
    shortTerm: asString(r.shortTerm ?? r.short_term ?? r["단기"]),
    midTerm: asString(r.midTerm ?? r.mid_term ?? r["중기"]),
    longTerm: asString(r.longTerm ?? r.long_term ?? r["장기"]),
  };
}

/**
 * 백엔드 응답 형태:
 * { id, status, experience_id, result: { ... } }
 *
 * 응답이 flat 으로 내려오는 경우(`result` wrapper 부재)도 동일하게 파싱한다.
 */
function mapIndividualDetail(dto: unknown): IndividualAnalysisResult {
  const r = asRecord(dto);
  const body = r.result && typeof r.result === "object" ? asRecord(r.result) : r;
  const deep = asRecord(body.deepAnalysis ?? body.deep_analysis);
  const diagnosis = asRecord(body.itemDiagnosis ?? body.item_diagnosis);

  const result: IndividualAnalysisResultBody = {
    status: asString(body.status ?? r.status),
    itemName: asString(body.itemName ?? body.item_name),
    itemType: asString(body.itemType ?? body.item_type),
    briefSummary: asString(body.briefSummary ?? body.brief_summary),
    deepAnalysis: {
      careerValue: asString(deep.careerValue ?? deep.career_value),
      strengths: asStringArray(deep.strengths),
      limitations: asStringArray(deep.limitations),
      applicableRoles: asStringArray(deep.applicableRoles ?? deep.applicable_roles),
      marketValue: asString(deep.marketValue ?? deep.market_value),
    },
    starFormat: mapStarFormat(body.starFormat ?? body.star_format),
    itemDiagnosis: {
      oneLineVerdict: asString(diagnosis.oneLineVerdict ?? diagnosis.one_line_verdict),
      weaknesses: asArray(diagnosis.weaknesses).map((w, i) => mapIndividualWeakness(w, i)),
      missingElements: asStringArray(diagnosis.missingElements ?? diagnosis.missing_elements),
      rewriteSuggestion: asString(diagnosis.rewriteSuggestion ?? diagnosis.rewrite_suggestion),
    },
    synergyRecommendations: asArray(
      body.synergyRecommendations ?? body.synergy_recommendations,
    ).map(mapSynergy),
    actionPlan: mapActionPlan(body.actionPlan ?? body.action_plan),
    missingInfoWarning: asString(body.missingInfoWarning ?? body.missing_info_warning),
  };

  return {
    id: asString(r.id ?? body.id),
    status: mapStatus(r.status ?? body.status),
    experienceId: asString(r.experienceId ?? r.experience_id ?? body.experience_id),
    result,
  };
}

function mapSynergyCombination(dto: unknown): SynergyCombination {
  const r = asRecord(dto);
  return {
    combinationTitle: asString(r.combinationTitle ?? r.combination_title),
    items: asStringArray(r.items),
    synergyReason: asString(r.synergyReason ?? r.synergy_reason),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
    applicableRoles: asStringArray(r.applicableRoles ?? r.applicable_roles),
  };
}

function mapContentQualityIssue(dto: unknown): ContentQualityIssue {
  const r = asRecord(dto);
  return {
    item: asString(r.item),
    issue: asString(r.issue),
    improvementHint: asString(r.improvementHint ?? r.improvement_hint),
  };
}

function mapJobRecommendation(dto: unknown): JobRecommendation {
  const r = asRecord(dto);
  return {
    company: asString(r.company),
    role: asString(r.role),
    deadline: asString(r.deadline),
    whyMatch: asString(r.whyMatch ?? r.why_match),
    url: asString(r.url),
  };
}

/**
 * 종합 분석 응답 형태 (prefix 없는 평탄형, result wrapper도 방어):
 * { status, user_school, user_department, brief_summary, detailed_summary,
 *   keyword_clustering, experience_insights, synergy_combinations[],
 *   additional_recommendations, resume_star_format[], action_plan,
 *   critical_diagnosis, valid_job_recommendations[], missing_info_warning }
 */
function mapComprehensiveDetail(dto: unknown): ComprehensiveAnalysisResult {
  const r = asRecord(dto);
  const body = r.result && typeof r.result === "object" ? asRecord(r.result) : r;

  const clustering = asRecord(body.keywordClustering ?? body.keyword_clustering);
  const insights = asRecord(body.experienceInsights ?? body.experience_insights);
  const additional = asRecord(body.additionalRecommendations ?? body.additional_recommendations);
  const diagnosis = asRecord(body.criticalDiagnosis ?? body.critical_diagnosis);

  return {
    id: asString(r.id ?? body.id),
    status: mapStatus(r.status ?? body.status),
    userSchool: asString(body.userSchool ?? body.user_school),
    userDepartment: asString(body.userDepartment ?? body.user_department),
    briefSummary: asString(body.briefSummary ?? body.brief_summary),
    detailedSummary: asString(body.detailedSummary ?? body.detailed_summary),
    keywordClustering: {
      personalityTendency: asStringArray(
        clustering.personalityTendency ?? clustering.personality_tendency,
      ),
      coreCompetency: asStringArray(clustering.coreCompetency ?? clustering.core_competency),
      jobIndustry: asStringArray(clustering.jobIndustry ?? clustering.job_industry),
    },
    experienceInsights: {
      motivation: asString(insights.motivation),
      learningPoints: asString(insights.learningPoints ?? insights.learning_points),
    },
    synergyCombinations: asArray(
      body.synergyCombinations ?? body.synergy_combinations,
    ).map(mapSynergyCombination),
    additionalRecommendations: {
      certifications: asStringArray(additional.certifications),
      clubsAndSocieties: asStringArray(
        additional.clubsAndSocieties ?? additional.clubs_and_societies,
      ),
      projectsAndContests: asStringArray(
        additional.projectsAndContests ?? additional.projects_and_contests,
      ),
    },
    resumeStarFormat: asArray(
      body.resumeStarFormat ?? body.resume_star_format,
    ).map(mapStarFormat),
    actionPlan: mapActionPlan(body.actionPlan ?? body.action_plan),
    criticalDiagnosis: {
      oneLineVerdict: asString(diagnosis.oneLineVerdict ?? diagnosis.one_line_verdict),
      weaknesses: asArray(diagnosis.weaknesses).map((w, i) => mapComprehensiveWeakness(w, i)),
      missingExperienceTypes: asStringArray(
        diagnosis.missingExperienceTypes ?? diagnosis.missing_experience_types,
      ),
      contentQualityIssues: asArray(
        diagnosis.contentQualityIssues ?? diagnosis.content_quality_issues,
      ).map(mapContentQualityIssue),
      competitorGap: asString(diagnosis.competitorGap ?? diagnosis.competitor_gap),
    },
    validJobRecommendations: asArray(
      body.validJobRecommendations ?? body.valid_job_recommendations,
    ).map(mapJobRecommendation),
    missingInfoWarning: asString(body.missingInfoWarning ?? body.missing_info_warning),
  };
}

function mapKeywordDefinition(dto: unknown): KeywordDefinition {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    definition: asString(r.definition),
    synonyms: asStringArray(r.synonyms),
    complianceCriteria: asStringArray(r.complianceCriteria ?? r.compliance_criteria),
  };
}

function mapKeywordCoverage(dto: unknown): KeywordCoverage {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    relatedCount: asNumber(r.relatedCount ?? r.related_count),
    totalCount: asNumber(r.totalCount ?? r.total_count),
    coveragePercent: asNumber(r.coveragePercent ?? r.coverage_percent),
  };
}

function mapKeywordEvidence(dto: unknown): KeywordEvidence {
  const r = asRecord(dto);
  return {
    type: asString(r.type),
    content: asString(r.content),
    sourceQuote: asString(r.sourceQuote ?? r.source_quote),
  };
}

function mapMatchedExperience(dto: unknown): MatchedExperience {
  const r = asRecord(dto);
  return {
    careerTitle: asString(r.careerTitle ?? r.career_title),
    organization: asString(r.organization),
    period: asString(r.period),
    relevance: asString(r.relevance),
    evidence: asArray(r.evidence).map(mapKeywordEvidence),
    matchedCriteria: asStringArray(r.matchedCriteria ?? r.matched_criteria),
    confidence: asString(r.confidence),
    confidenceReason: asString(r.confidenceReason ?? r.confidence_reason),
  };
}

function mapKeywordMatchedGroup(dto: unknown): KeywordMatchedGroup {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    experiences: asArray(r.experiences).map(mapMatchedExperience),
  };
}

function mapKeywordStoryline(dto: unknown): KeywordStoryline {
  const r = asRecord(dto);
  const structure = asRecord(r.structure);
  const used = asRecord(r.usedExperiences ?? r.used_experiences);
  return {
    keyword: asString(r.keyword),
    storylineTitle: asString(r.storylineTitle ?? r.storyline_title),
    structure: {
      start: asString(structure.start),
      development: asString(structure.development),
      evidence: asString(structure.evidence),
      growth: asString(structure.growth),
      destination: asString(structure.destination),
    },
    usedExperiences: {
      core: asStringArray(used.core),
      supporting: asStringArray(used.supporting),
    },
    keyQuotes: asStringArray(r.keyQuotes ?? r.key_quotes),
  };
}

/**
 * 보강 가이드의 항목들은 백엔드 확정 형태가 미정이라 string 또는 객체일 수 있다.
 * 객체일 경우 가장 의미 있는 텍스트 필드를 추려 문자열로 평탄화한다.
 */
function coerceImprovementText(value: unknown): string {
  if (typeof value === "string") return value;
  const r = asRecord(value);
  return asString(
    r.description ??
      r.text ??
      r.content ??
      r.suggestion ??
      r.reason ??
      r.recommendation,
  );
}

function mapKeywordSpecificRecommendation(dto: unknown): KeywordSpecificRecommendation {
  if (typeof dto === "string") return { keyword: "", description: dto };
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    description: coerceImprovementText(r.recommendation ?? r.description ?? r),
  };
}

function mapKeywordDetail(dto: unknown): KeywordAnalysisResult {
  const r = asRecord(dto);
  // 응답이 result wrapper로 감싸져 올 가능성도 방어한다.
  const body = r.result && typeof r.result === "object" ? asRecord(r.result) : r;
  const guide = asRecord(body.improvementGuide ?? body.improvement_guide);
  const selection = asRecord(body.selectionCriteria ?? body.selection_criteria);

  return {
    id: asString(r.id ?? body.id),
    status: mapStatus(r.status ?? body.status),
    analysisDate: asString(body.analysisDate ?? body.analysis_date ?? body.created_at),
    keywords: asStringArray(body.keywords ?? body.selected_keywords),
    targetScenario: asString(body.targetScenario ?? body.target_scenario),
    keywordDefinitions: asArray(
      body.keywordDefinitions ?? body.keyword_definitions,
    ).map(mapKeywordDefinition),
    selectionCriteria: {
      summary: asString(selection.summary),
      criteria: asStringArray(selection.criteria),
    },
    coverage: asArray(body.coverage).map(mapKeywordCoverage),
    matchedExperiences: asArray(
      body.matchedExperiences ?? body.matched_experiences,
    ).map(mapKeywordMatchedGroup),
    storylines: asArray(body.storylines).map(mapKeywordStoryline),
    improvementGuide: {
      informationEnhancement: asArray(
        guide.informationEnhancement ?? guide.information_enhancement,
      ).map(coerceImprovementText).filter(Boolean),
      experienceExpansion: asArray(
        guide.experienceExpansion ?? guide.experience_expansion,
      ).map(coerceImprovementText).filter(Boolean),
      keywordSpecificRecommendations: asArray(
        guide.keywordSpecificRecommendations ?? guide.keyword_specific_recommendations,
      ).map(mapKeywordSpecificRecommendation),
    },
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

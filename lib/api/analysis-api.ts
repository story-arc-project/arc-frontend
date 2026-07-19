import { api } from "./client";
import { getExperiences } from "./experience-api";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AnalysisHomeSummary,
  AnalysisSnapshot,
  AnalysisType,
  AnalysisStatus,
  ExperienceRef,
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
  ComplianceCriterion,
  KeywordCoverage,
  KeywordEvidence,
  MatchedExperience,
  KeywordMatchedGroup,
  KeywordStoryline,
  StorylineChronoItem,
  StorylineTurningPoint,
  StorylineConnectiveLogic,
  KeyQuote,
  KeywordSpecificRecommendation,
  KeywordRecommendationItem,
  ImprovementOverallDirection,
  InformationEnhancement,
  ExperienceExpansion,
  KeywordSuggestion,
  BookmarkedSnapshot,
  SelectableExperience,
} from "@/types/analysis";

import { isDemoMode } from "@/lib/demo/state";

// 환경 변수 또는 데모 라우트(/demo) 진입 시 mock 데이터를 사용한다.
function shouldMock(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true" || isDemoMode();
}

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

/**
 * null 을 빈 문자열로 뭉개지 않는다 — 종합 분석 experiences[].title 은
 * 경험이 삭제되면 null 로 오고, 그 신호를 화면에서 "삭제된 경험"으로 구분해야 한다(계약 §2.2).
 */
function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapExperienceRef(dto: unknown): ExperienceRef {
  const r = asRecord(dto);
  return {
    id: asString(r.id),
    title: asNullableString(r.title),
  };
}

// ─── schema_version 가드 (계약 §3.5) ────────────────────────
// 코드가 아는 스키마 버전. result 구조가 바뀌면 백엔드가 버전을 올리고 여기 추가한다.
const KNOWN_SCHEMA_VERSIONS = new Set([
  "keyword/4.1",
  "individual/1.0",
  "comprehensive/1.0",
  "resume/1.0",
]);

/** result.schema_version 가 "모르는 값"으로 명시돼 올 때 던진다. 상세 페이지가 안내로 전환한다. */
export class UnsupportedSchemaError extends Error {
  constructor(readonly schemaVersion: string) {
    super(`unsupported schema_version: ${schemaVersion}`);
    this.name = "UnsupportedSchemaError";
  }
}

/**
 * 모르는 schema_version 이면 조용한 빈 화면 대신 "표시할 수 없습니다"로 전환한다(계약 §3.5).
 * 부재(null)는 아직 계약을 이행하지 않은 백엔드로 보고 기존대로 렌더한다 — blank 금지.
 * 즉 "필드 없음"과 "모르는 값이 명시적으로 옴"을 다르게 취급한다.
 */
function assertRenderableSchema(data: unknown): void {
  // 매퍼들은 result 래퍼가 없는 flat 응답도, keyword 처럼 result 를 이중으로 감싼
  // 응답(internal.py, 계약 §3 미반영)도 지원한다. 따라서 schema_version 을 최상위부터
  // 중첩 result 체인을 따라 내려가며 각 층에서 검사한다 — 어느 층이든 모르는 값이
  // 명시되면 언랩 후 구 매퍼로 조용히 파싱되지 않도록 throw 한다.
  let node = asRecord(data);
  let guard = 0;
  while (guard <= 3) {
    const v = node.schema_version ?? node.schemaVersion;
    if (typeof v === "string" && !KNOWN_SCHEMA_VERSIONS.has(v)) {
      throw new UnsupportedSchemaError(v);
    }
    if (node.result && typeof node.result === "object" && !Array.isArray(node.result)) {
      node = asRecord(node.result);
      guard += 1;
    } else {
      break;
    }
  }
}

/**
 * 분석 생성 응답에서 id 를 추출한다(FRT-38).
 * 백엔드가 id 를 `data` 봉투 안(`{ data: { id } }`)에 넣을지, 기존 `{ status, message }`
 * 와 같은 최상위(`{ status, message, id }`)에 둘지 확정 전이므로 두 위치를 모두 본다.
 * 부재 시 null → 호출부는 "큐 적재됨"으로 보고 목록으로 안내한다.
 */
function extractAnalysisId(res: unknown): string | null {
  const root = asRecord(res);
  const data = asRecord(root.data);
  const id =
    asString(data.id ?? data.analysisId ?? data.analysis_id) ||
    asString(root.id ?? root.analysisId ?? root.analysis_id);
  return id || null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

/**
 * 목록 status 필터 술어. 필터 키는 매핑된(프런트) status 와 비교한다.
 * '대기 중'(pending) 탭은 백엔드 queued(→processing) 와 pending 을 모두 포함한다.
 * (FRT-41: queued 항목이 "pending" 키와 일치하지 않아 '대기 중' 탭이 항상 비던 버그)
 */
function matchesStatusFilter(status: AnalysisStatus, filter: string): boolean {
  if (filter === "pending") return status === "pending" || status === "processing";
  return status === filter;
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
  const experiencesRaw = r.experiences;
  return {
    id: asString(r.id),
    type: asAnalysisType(r.type, fallbackType),
    title: asString(r.title),
    status: mapStatus(r.status),
    createdAt: asString(r.createdAt ?? r.created_at),
    experienceCount: asNumber(r.experienceCount ?? r.experience_count),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked),
    selectedExperienceIds: Array.isArray(experienceIdsRaw)
      ? (experienceIdsRaw as string[])
      : typeof singleExperienceId === "string" && singleExperienceId
        ? [singleExperienceId]
        : undefined,
    selectedKeywords: Array.isArray(keywordsRaw)
      ? (keywordsRaw as string[])
      : undefined,
    experiences: Array.isArray(experiencesRaw)
      ? experiencesRaw.map(mapExperienceRef)
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
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked ?? body.isBookmarked ?? body.is_bookmarked),
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
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked ?? body.isBookmarked ?? body.is_bookmarked),
    // 경험 참조는 result 밖(엔벨로프)에 온다(계약 §3.6) — r 우선, body 는 방어적 폴백.
    experiences: asArray(r.experiences ?? body.experiences).map(mapExperienceRef),
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

// v4.1 키워드 result 매퍼. 계약 §3.4 는 접두사 제거를 요구하지만 배포 상태가
// 불확실하므로 최상위 키는 A_ 접두사·무접두사·camelCase 를 모두 읽는다(백지 방지).
// 내부 형태도 구버전(문자열 배열) ↔ 신버전(객체/숫자 배열) 이중호환으로 파싱한다.

// 숫자 또는 숫자 문자열("3")을 number 로. 아니면 fallback.
// compliance id ↔ matched_criteria 조인 대칭을 위해 둘 다 이 규칙을 쓴다.
function asNumericId(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * matched_criteria 를 조인 키(number)로 파싱하되, 구버전 백엔드가 기준을 서술 문자열로
 * 보내는 경우(비숫자 문자열)엔 그 문자열을 그대로 보존해 화면이 조용히 비지 않게 한다.
 * v4.1(number) → 조인, 구버전(text) → 문자열 뱃지 직접 표시.
 */
function mapMatchedCriteria(value: unknown): (number | string)[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): number | string | null => {
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      return null;
    })
    .filter((v): v is number | string => v !== null);
}

function mapComplianceCriterion(dto: unknown, index: number): ComplianceCriterion {
  // v4.1: { id, criterion, signal_description }. 구버전은 문자열이었다.
  if (typeof dto === "string") {
    return { id: index + 1, criterion: dto, signalDescription: "" };
  }
  const r = asRecord(dto);
  return {
    id: asNumericId(r.id, index + 1),
    criterion: asString(r.criterion ?? r.text),
    signalDescription: asString(r.signalDescription ?? r.signal_description),
  };
}

function mapKeywordDefinition(dto: unknown): KeywordDefinition {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    definition: asString(r.definition),
    synonyms: asStringArray(r.synonyms),
    complianceCriteria: asArray(
      r.complianceCriteria ?? r.compliance_criteria,
    ).map(mapComplianceCriterion),
  };
}

function mapKeywordCoverage(dto: unknown): KeywordCoverage {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    relatedCount: asNumber(r.relatedCount ?? r.related_count),
    totalCount: asNumber(r.totalCount ?? r.total_count),
    coveragePercent: asNumber(r.coveragePercent ?? r.coverage_percent),
    highCount: asNumber(r.highCount ?? r.high_count),
    mediumCount: asNumber(r.mediumCount ?? r.medium_count),
    lowCount: asNumber(r.lowCount ?? r.low_count),
  };
}

/**
 * C_coverage 가 총계·비율만 주고 high/medium/low 카운트를 안 줄 때(v4.1 과도기),
 * D_matched_experiences 의 relevance 로 키워드별 카운트를 파생한다.
 * 카운트가 하나라도 있으면 백엔드 값을 그대로 신뢰한다.
 */
function fillCoverageCounts(
  coverage: KeywordCoverage[],
  groups: KeywordMatchedGroup[],
): KeywordCoverage[] {
  return coverage.map((c) => {
    if (c.highCount || c.mediumCount || c.lowCount) return c;
    const group = groups.find((g) => g.keyword === c.keyword);
    if (!group) return c;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    for (const exp of group.experiences) {
      if (exp.relevance === "high") highCount += 1;
      else if (exp.relevance === "medium") mediumCount += 1;
      else if (exp.relevance === "low") lowCount += 1;
    }
    if (!highCount && !mediumCount && !lowCount) return c;
    return { ...c, highCount, mediumCount, lowCount };
  });
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
    relevanceSummary: asString(r.relevanceSummary ?? r.relevance_summary),
    evidence: asArray(r.evidence).map(mapKeywordEvidence),
    matchedCriteria: mapMatchedCriteria(r.matchedCriteria ?? r.matched_criteria),
    confidence: asString(r.confidence),
    confidenceReason: asString(r.confidenceReason ?? r.confidence_reason),
    // 명시 플래그가 없으면 relevance=low 를 참고용으로 파생한다(백엔드가 별도 플래그를
    // 안 줘도 저신뢰 근거가 일반 매칭처럼 보이지 않도록). 명시 false 는 존중한다.
    isReferenceOnly: asBoolean(
      r.isReferenceOnly ?? r.is_reference_only ?? asString(r.relevance) === "low",
    ),
  };
}

function mapKeywordMatchedGroup(dto: unknown): KeywordMatchedGroup {
  const r = asRecord(dto);
  return {
    keyword: asString(r.keyword),
    experiences: asArray(r.experiences).map(mapMatchedExperience),
  };
}

function mapChronoItem(dto: unknown, index: number): StorylineChronoItem {
  const r = asRecord(dto);
  return {
    order: asNumber(r.order, index + 1),
    experience: asString(r.experience),
    period: asString(r.period),
    isDated: asBoolean(r.isDated ?? r.is_dated),
  };
}

function mapTurningPoint(dto: unknown): StorylineTurningPoint {
  const r = asRecord(dto);
  return {
    experience: asString(r.experience),
    period: asString(r.period),
    trigger: asString(r.trigger),
    whatChanged: asString(r.whatChanged ?? r.what_changed),
  };
}

function mapConnectiveLogic(dto: unknown): StorylineConnectiveLogic {
  const r = asRecord(dto);
  return {
    fromExperience: asString(r.fromExperience ?? r.from_experience),
    toExperience: asString(r.toExperience ?? r.to_experience),
    relationType: asString(r.relationType ?? r.relation_type),
    connection: asString(r.connection),
    temporalNote: asNullableString(r.temporalNote ?? r.temporal_note),
  };
}

function mapKeyQuote(dto: unknown): KeyQuote {
  // v4.1: { career_title, quote }. 구버전은 문자열.
  if (typeof dto === "string") return { careerTitle: "", quote: dto };
  const r = asRecord(dto);
  return {
    careerTitle: asString(r.careerTitle ?? r.career_title),
    quote: asString(r.quote ?? r.content ?? r.text),
  };
}

function mapKeywordStoryline(dto: unknown): KeywordStoryline {
  const r = asRecord(dto);
  const structure = asRecord(r.structure);
  const used = asRecord(r.usedExperiences ?? r.used_experiences);
  return {
    keyword: asString(r.keyword),
    storylineTitle: asString(r.storylineTitle ?? r.storyline_title),
    tagline: asString(r.tagline),
    timelineStatus: asString(r.timelineStatus ?? r.timeline_status),
    timelineNote: asNullableString(r.timelineNote ?? r.timeline_note),
    chronologicalSequence: asArray(
      r.chronologicalSequence ?? r.chronological_sequence,
    ).map(mapChronoItem),
    narrative: asString(r.narrative),
    turningPoints: asArray(r.turningPoints ?? r.turning_points).map(mapTurningPoint),
    connectiveLogic: asArray(r.connectiveLogic ?? r.connective_logic).map(mapConnectiveLogic),
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
    keyQuotes: asArray(r.keyQuotes ?? r.key_quotes).map(mapKeyQuote),
  };
}

function mapOverallDirection(dto: unknown): ImprovementOverallDirection | null {
  if (!dto || typeof dto !== "object") return null;
  const r = asRecord(dto);
  const d: ImprovementOverallDirection = {
    currentProfileSummary: asString(r.currentProfileSummary ?? r.current_profile_summary),
    shortTerm: asString(r.shortTerm ?? r.short_term),
    midTerm: asString(r.midTerm ?? r.mid_term),
    priorityKeyword: asString(r.priorityKeyword ?? r.priority_keyword),
    priorityReason: asString(r.priorityReason ?? r.priority_reason),
  };
  return Object.values(d).some(Boolean) ? d : null;
}

function mapInformationEnhancement(dto: unknown): InformationEnhancement {
  // v4.1: 구조화 객체. 구버전은 문자열이었다.
  if (typeof dto === "string") {
    return { target: "", missing: "", howToAdd: dto, reason: "", priority: "" };
  }
  const r = asRecord(dto);
  return {
    target: asString(r.target),
    missing: asString(r.missing),
    // 레거시 객체형({ description }/{ text }/{ suggestion })도 흡수해 항목이
    // 빈값으로 걸러지지 않게 한다(구 mapper 의 텍스트 폴백 유지).
    howToAdd: asString(r.howToAdd ?? r.how_to_add ?? r.description ?? r.text ?? r.suggestion),
    reason: asString(r.reason),
    priority: asString(r.priority),
  };
}

function isNonEmptyInformationEnhancement(e: InformationEnhancement): boolean {
  return Boolean(e.target || e.missing || e.howToAdd || e.reason || e.priority);
}

function mapExperienceExpansion(dto: unknown): ExperienceExpansion {
  if (typeof dto === "string") {
    return {
      gapDescription: dto,
      suggestedExperienceType: "",
      whyHelpful: "",
      examples: [],
      priority: "",
    };
  }
  const r = asRecord(dto);
  return {
    // 레거시 객체형 텍스트 필드도 흡수(구 mapper 의 텍스트 폴백 유지).
    gapDescription: asString(
      r.gapDescription ?? r.gap_description ?? r.description ?? r.text ?? r.suggestion,
    ),
    suggestedExperienceType: asString(r.suggestedExperienceType ?? r.suggested_experience_type),
    whyHelpful: asString(r.whyHelpful ?? r.why_helpful),
    examples: asStringArray(r.examples),
    priority: asString(r.priority),
  };
}

function isNonEmptyExperienceExpansion(e: ExperienceExpansion): boolean {
  return Boolean(
    e.gapDescription ||
      e.suggestedExperienceType ||
      e.whyHelpful ||
      e.examples.length > 0 ||
      e.priority,
  );
}

function mapRecommendationItem(dto: unknown): KeywordRecommendationItem {
  if (typeof dto === "string") return { type: "", title: dto, expectedEffect: "" };
  const r = asRecord(dto);
  return {
    type: asString(r.type),
    title: asString(r.title),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
  };
}

function mapKeywordSpecificRecommendation(dto: unknown): KeywordSpecificRecommendation {
  const r = asRecord(dto);
  const recsRaw = r.recommendations;
  // v4.1: { keyword, recommendations[] }. 구버전은 { keyword, description } 또는 문자열.
  if (Array.isArray(recsRaw)) {
    return {
      keyword: asString(r.keyword),
      recommendations: recsRaw.map(mapRecommendationItem),
    };
  }
  const legacy = typeof dto === "string" ? dto : asString(r.description ?? r.recommendation);
  return {
    keyword: asString(r.keyword),
    recommendations: legacy ? [{ type: "", title: legacy, expectedEffect: "" }] : [],
  };
}

// 키워드 분석 본문(A-F)이 이 껍질에 직접 들어있는지 판별한다. 이중중첩 언랩의 종료 조건.
const KEYWORD_CONTENT_KEYS = [
  "keywordDefinitions", "keyword_definitions", "A_keyword_definitions",
  "selectionCriteria", "selection_criteria", "B_selection_criteria",
  "coverage", "C_coverage",
  "matchedExperiences", "matched_experiences", "D_matched_experiences",
  "storylines", "E_storylines",
  "improvementGuide", "improvement_guide", "F_improvement_guide",
];

function hasKeywordContent(body: UnknownRecord): boolean {
  return KEYWORD_CONTENT_KEYS.some((k) => k in body);
}

/**
 * 백엔드 internal.py 가 keyword 결과만 상위 result 언랩을 빠뜨려
 * `{ careers, result: { A-F }, status }` 형태로 한 겹 더 감싸 보낼 수 있다(계약 §3 미반영).
 * 한 겹만 벗기면 A_* 를 못 뚫어 화면이 백지가 된다. 본문 키가 나타날 때까지 result 를 벗기되,
 * 바깥 껍질의 메타(keywords·target·status 등)는 안쪽 본문과 얕게 병합해 보존한다.
 * 단일중첩(정상 계약)이면 본문 키가 바로 있으므로 그대로 반환 — 회귀 없음.
 */
function unwrapKeywordBody(dto: UnknownRecord): UnknownRecord {
  let body = dto;
  // result 래퍼가 있으면 우선 한 겹 벗긴다(기존 동작 유지).
  if (body.result && typeof body.result === "object" && !Array.isArray(body.result)) {
    body = asRecord(body.result);
  }
  // 본문이 여전히 안 보이고 안쪽에 또 result 객체가 있으면(이중중첩) 병합해 뚫는다.
  let guard = 0;
  while (
    !hasKeywordContent(body) &&
    body.result &&
    typeof body.result === "object" &&
    !Array.isArray(body.result) &&
    guard < 3
  ) {
    body = { ...body, ...asRecord(body.result) };
    guard += 1;
  }
  return body;
}

function mapKeywordDetail(dto: unknown): KeywordAnalysisResult {
  const r = asRecord(dto);
  const body = unwrapKeywordBody(r);
  const guide = asRecord(
    body.improvementGuide ?? body.improvement_guide ?? body.F_improvement_guide,
  );
  const selection = asRecord(
    body.selectionCriteria ?? body.selection_criteria ?? body.B_selection_criteria,
  );
  const matchedExperiences = asArray(
    body.matchedExperiences ?? body.matched_experiences ?? body.D_matched_experiences,
  ).map(mapKeywordMatchedGroup);
  const coverage = fillCoverageCounts(
    asArray(body.coverage ?? body.C_coverage).map(mapKeywordCoverage),
    matchedExperiences,
  );

  return {
    id: asString(r.id ?? body.id),
    status: mapStatus(r.status ?? body.status),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked ?? body.isBookmarked ?? body.is_bookmarked),
    analysisDate: asString(body.analysisDate ?? body.analysis_date ?? body.created_at),
    analysisMode: asString(body.analysisMode ?? body.analysis_mode),
    keywords: asStringArray(body.keywords ?? body.selectedKeywords ?? body.selected_keywords),
    targetScenario: asString(body.targetScenario ?? body.target_scenario ?? body.target),
    keywordDefinitions: asArray(
      body.keywordDefinitions ?? body.keyword_definitions ?? body.A_keyword_definitions,
    ).map(mapKeywordDefinition),
    selectionCriteria: {
      summary: asString(selection.summary),
      criteria: asStringArray(selection.criteria),
    },
    coverage,
    matchedExperiences,
    storylines: asArray(body.storylines ?? body.E_storylines).map(mapKeywordStoryline),
    improvementGuide: {
      overallDirection: mapOverallDirection(guide.overallDirection ?? guide.overall_direction),
      // 알맹이 없는 항목(모든 필드가 빈 문자열/빈 배열)은 걸러 빈 카드 렌더를 막는다.
      informationEnhancement: asArray(
        guide.informationEnhancement ?? guide.information_enhancement,
      )
        .map(mapInformationEnhancement)
        .filter(isNonEmptyInformationEnhancement),
      experienceExpansion: asArray(
        guide.experienceExpansion ?? guide.experience_expansion,
      )
        .map(mapExperienceExpansion)
        .filter(isNonEmptyExperienceExpansion),
      keywordSpecificRecommendations: asArray(
        guide.keywordSpecificRecommendations ?? guide.keyword_specific_recommendations,
      )
        .map(mapKeywordSpecificRecommendation)
        .filter((r) => r.keyword !== "" || r.recommendations.length > 0),
    },
  };
}

// ─── Individual ─────────────────────────────────────────────

export async function getIndividualAnalysisList(params?: {
  status?: string;
}): Promise<AnalysisSnapshot[]> {
  const status = params?.status;
  if (shouldMock())
    return mock(async () => {
      const { mockIndividualAnalysisList } = await mocks();
      if (status && status !== "all")
        return mockIndividualAnalysisList.filter((s) => matchesStatusFilter(s.status, status));
      return mockIndividualAnalysisList;
    });
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/individual");
  const items = unwrapList(res.data).map((dto) => mapSnapshot(dto, "individual")).filter((s) => s.id);
  if (status && status !== "all") {
    return items.filter((s) => matchesStatusFilter(s.status, status));
  }
  return items;
}

export async function getIndividualAnalysisResult(
  analysisId: string,
): Promise<IndividualAnalysisResult> {
  if (shouldMock())
    return mock(async () => (await mocks()).mockIndividualAnalysisResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/individual/${analysisId}`,
  );
  assertRenderableSchema(res.data);
  return mapIndividualDetail(res.data);
}

// ─── Comprehensive ──────────────────────────────────────────

export async function getComprehensiveList(): Promise<AnalysisSnapshot[]> {
  if (shouldMock()) return mock(async () => (await mocks()).mockComprehensiveList);
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/comprehensive");
  return unwrapList(res.data).map((dto) => mapSnapshot(dto, "comprehensive")).filter((s) => s.id);
}

/**
 * POST /analysis/comprehensive
 * body: `{ experiences: string[] }`
 *
 * 백엔드 스펙상 응답은 `{ status, message }`만 반환하고 id 는 포함되지 않는다(FRT-38).
 * 서버가 id 를 확장 포함하면 그 값으로 후속 폴링을 진행하고, 부재 시 `analysisId: null`
 * 을 반환한다. 호출부는 null 을 오류가 아니라 "큐 적재됨"으로 보고 목록으로 안내한다.
 * (id 없이 목록에서 폴링 대상을 추측하는 우회는 race 때문에 하지 않는다.)
 */
export async function createComprehensiveAnalysis(
  experienceIds: string[],
): Promise<{ analysisId: string | null }> {
  if (shouldMock())
    return mock(async () => ({ analysisId: "comp-new-" + Date.now() }));
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/analysis/comprehensive",
    { experiences: experienceIds },
  );
  return { analysisId: extractAnalysisId(res) };
}

export async function getComprehensiveResult(
  analysisId: string,
): Promise<ComprehensiveAnalysisResult> {
  if (shouldMock())
    return mock(async () => (await mocks()).mockComprehensiveResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/comprehensive/${analysisId}`,
  );
  assertRenderableSchema(res.data);
  return mapComprehensiveDetail(res.data);
}

export async function deleteComprehensiveAnalysis(
  analysisId: string,
): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  await api.delete<void>(`/analysis/comprehensive/${analysisId}`);
}

// ─── Keyword ────────────────────────────────────────────────

/**
 * 키워드 추천은 백엔드 스펙 미정. 일단 빈 배열 stub.
 * TODO: 서버 스펙 확정 시 실제 엔드포인트로 연결.
 */
export async function getKeywordSuggestions(): Promise<KeywordSuggestion[]> {
  if (shouldMock()) return mock(async () => (await mocks()).mockKeywordSuggestions);
  return [];
}

export async function getKeywordList(): Promise<AnalysisSnapshot[]> {
  if (shouldMock()) return mock(async () => (await mocks()).mockKeywordList);
  const res = await api.get<ApiSuccessResponse<unknown>>("/analysis/keyword");
  return unwrapList(res.data).map((dto) => mapSnapshot(dto, "keyword")).filter((s) => s.id);
}

/**
 * POST /analysis/keyword
 * body: `{ keywords: string[] }`
 *
 * 백엔드 스펙상 응답은 `{ status, message }`만 반환하고 id 는 포함되지 않는다(FRT-38).
 * 서버가 id 를 확장 포함하면 그 값으로 후속 폴링을 진행하고, 부재 시 `analysisId: null`
 * 을 반환한다. 호출부는 null 을 오류가 아니라 "큐 적재됨"으로 보고 목록으로 안내한다.
 * (id 없이 목록에서 폴링 대상을 추측하는 우회는 race 때문에 하지 않는다.)
 */
export async function createKeywordAnalysis(
  keywordLabels: string[],
  target = "",
): Promise<{ analysisId: string | null }> {
  if (shouldMock())
    return mock(async () => ({ analysisId: "kw-new-" + Date.now() }));
  // target 은 기본값 "" 이라 안 보내도 현재 동작과 동일하다(계약 §2.3, 하위호환).
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/analysis/keyword",
    { keywords: keywordLabels, target },
  );
  return { analysisId: extractAnalysisId(res) };
}

export async function getKeywordResult(
  analysisId: string,
): Promise<KeywordAnalysisResult> {
  if (shouldMock()) return mock(async () => (await mocks()).mockKeywordResult);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/analysis/keyword/${analysisId}`,
  );
  assertRenderableSchema(res.data);
  return mapKeywordDetail(res.data);
}

export async function deleteKeywordAnalysis(analysisId: string): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  await api.delete<void>(`/analysis/keyword/${analysisId}`);
}

// ─── Bookmarks ──────────────────────────────────────────────

export async function getBookmarks(params?: {
  type?: string;
}): Promise<BookmarkedSnapshot[]> {
  if (shouldMock())
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
  if (shouldMock()) return mock(async () => undefined);
  await api.post<void>(`/analysis/bookmarks/${analysisId}`);
}

export async function removeBookmark(analysisId: string): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  await api.delete<void>(`/analysis/bookmarks/${analysisId}`);
}

// ─── Meta / Delete ──────────────────────────────────────────

/**
 * PATCH /analysis/{type}/:id — 제목 변경 등 메타 수정.
 * 계약(§2)상 경로는 타입별로 갈린다. individual 은 경험에 종속돼 이름을
 * 따로 수정할 수 없으므로(경험명 변경 시 따라감) 에러를 던진다 — deleteAnalysis 와 동일.
 */
export async function updateAnalysisMeta(
  analysisId: string,
  type: AnalysisType,
  data: { title: string },
): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  if (type === "individual") {
    throw new Error("개별 분석은 이름을 바꿀 수 없어요.");
  }
  await api.patch<void>(`/analysis/${type}/${analysisId}`, data);
}

/**
 * 스펙상 `/analysis/:id` DELETE는 없으므로 타입별 엔드포인트로 분기한다.
 * individual 은 스펙상 삭제 엔드포인트가 없어 에러를 던진다.
 */
export async function deleteAnalysis(
  analysisId: string,
  type: AnalysisType,
): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
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
  if (shouldMock())
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
  if (shouldMock())
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
  if (shouldMock())
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

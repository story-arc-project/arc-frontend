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
  StrengthLevel,
  SynergyPriority,
  ComprehensiveAnalysisResult,
  ComprehensiveWeakness,
  SynergyCombination,
  ContentQualityIssue,
  ContentQualityHighlight,
  Certification,
  ClubSociety,
  ProjectContest,
  Strength,
  StrengthDiagnosis,
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

/**
 * 배열은 레코드가 아니다(FRT-134). `typeof [] === "object"` 라 가드가 없으면 배열이 레코드로
 * 캐스팅된다. assertRenderableSchema·unwrapKeywordBody 가 이미 쓰는 것과 같은 기준을
 * 정규화 층에도 세워 세 지점이 어긋나지 않게 한다.
 *
 * ⚠️ 지금은 이 가드를 빼도 관측되는 동작 차이가 없다 — 배열의 키(숫자 인덱스·length)가
 * 매퍼가 읽는 키와 겹치지 않아 어느 쪽이든 결과가 빈 값이고, 화면은 hasAnyContent 판정이
 * 지킨다. 앞으로 body 를 키 기반으로 순회(Object.keys/values)하는 코드가 생기면 그때
 * 배열이 조용히 새는 것을 막는 구조적 방어다. 뮤테이션 테스트로는 잡히지 않는다.
 */
function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

/**
 * 매핑 결과에 실제로 그릴 값이 하나라도 있는지 본다(FRT-134).
 * 판정 기준을 백엔드 키 이름 목록이 아니라 **매핑 결과**로 두는 이유: 화면의 각 섹션이
 * 쓰는 빈 값 판정과 같은 기준이 되고(= 화면이 아무것도 못 그리면 본문 부재), 키 이름이
 * 늘어도 목록을 따로 유지보수하지 않아도 된다.
 */
function hasAnyContent(value: unknown): boolean {
  if (typeof value === "string") return value !== "";
  if (typeof value === "number") return Number.isFinite(value);
  // 길이만 보면 `[{}]` 처럼 원소는 있으나 알맹이가 없는 배열을 본문으로 오판한다.
  // 원소까지 재귀해야 화면 기준(그릴 값이 있는가)과 어긋나지 않는다.
  if (Array.isArray(value)) return value.some(hasAnyContent);
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).some(hasAnyContent);
  }
  // boolean 은 컨텐츠로 치지 않는다 — 방어 파싱의 기본값(false)이 흔해 오탐을 만든다.
  return false;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * 약점·강점의 `id` 는 백엔드 계약상 **number**(`"id": 1`)다. asString 으로 읽으면 항상
 * 인덱스 폴백으로 떨어져 서버가 준 식별자를 조용히 버린다 — 숫자도 받아 문자열로 보존한다.
 */
function asIdString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
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

// result 래퍼 최대 중첩 깊이. schema_version 검사(assertRenderableSchema)와 본문 언랩
// (unwrapKeywordBody)이 반드시 같은 깊이를 훑어야 한다 — 언랩이 더 깊이 뚫는데 가드가
// 얕게 멈추면 모르는 schema_version 이 검사망을 통과해 구 매퍼로 조용히 파싱된다(2718b84
// 계열 버그). 두 순회가 이 상수 하나에서 깊이를 파생해 구조적으로 어긋나지 않게 한다.
const MAX_RESULT_NESTING = 4;

// ─── schema_version 가드 (계약 §3.5) ────────────────────────
// 코드가 아는 스키마 버전. result 구조가 바뀌면 백엔드가 버전을 올리고 여기 추가한다.
const KNOWN_SCHEMA_VERSIONS = new Set([
  "keyword/4.1",
  "individual/1.0",
  // comprehensive/1.0 은 구 레코드 호환용으로 유지한다 — 1.0 payload 엔 strength_diagnosis 가
  // 없지만 매퍼가 부재를 빈 구조로 안전 처리하므로 렌더된다.
  "comprehensive/1.0",
  "comprehensive/2.0",
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
  // guard 0..MAX_RESULT_NESTING → 언랩이 도달할 수 있는 가장 깊은 본문까지 각 층을 검사한다.
  while (guard <= MAX_RESULT_NESTING) {
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
  // 미상값은 과소평가하지 않도록 "major"(중간) 로 폴백한다 — 약점을 "참고"로 눌러버리면
  // 사용자에게 불이익(백엔드 프롬프트의 약점 보존 원칙과 같은 방향).
  return value === "critical" || value === "major" || value === "minor" ? value : "major";
}

function asStrengthLevel(value: unknown): StrengthLevel {
  return value === "outstanding" || value === "strong" || value === "notable"
    ? value
    : "notable";
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
    id: asIdString(r.id, `w-${index}`),
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
    id: asIdString(r.id, `w-${index}`),
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
    // result.status 는 본문이 아니라 엔벨로프에서 폴백돼 들어오는 메타다(위 `body.status ?? r.status`).
    // 판정에 넣으면 본문이 통째로 없어도 status 하나 때문에 "본문 있음"이 된다.
    hasResultBody: hasAnyContent({ ...result, status: "" }),
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

function mapContentQualityHighlight(dto: unknown): ContentQualityHighlight {
  const r = asRecord(dto);
  return {
    item: asString(r.item),
    highlight: asString(r.highlight),
    whyEffective: asString(r.whyEffective ?? r.why_effective),
  };
}

// ── 추가 활동 추천 (v2.0 객체 배열) ─────────────────────────
function mapCertification(dto: unknown): Certification {
  const r = asRecord(dto);
  return {
    name: asString(r.name),
    reason: asString(r.reason),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
    estimatedDuration: asString(r.estimatedDuration ?? r.estimated_duration),
    url: asNullableString(r.url),
    issuer: asString(r.issuer),
  };
}

function mapClubSociety(dto: unknown): ClubSociety {
  const r = asRecord(dto);
  return {
    name: asString(r.name),
    type: asString(r.type),
    schoolAffiliation: asString(r.schoolAffiliation ?? r.school_affiliation),
    description: asString(r.description),
    reason: asString(r.reason),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
    url: asNullableString(r.url),
    searchQuery: asString(r.searchQuery ?? r.search_query),
    searchVerified: asBoolean(r.searchVerified ?? r.search_verified),
  };
}

function mapProjectContest(dto: unknown): ProjectContest {
  const r = asRecord(dto);
  return {
    name: asString(r.name),
    organizer: asString(r.organizer),
    reason: asString(r.reason),
    expectedEffect: asString(r.expectedEffect ?? r.expected_effect),
    url: asNullableString(r.url),
    deadline: asNullableString(r.deadline),
    isRegular: asBoolean(r.isRegular ?? r.is_regular),
  };
}

// ── 강점 진단 (v2.0) ────────────────────────────────────────
function mapStrength(dto: unknown, index: number): Strength {
  const r = asRecord(dto);
  return {
    id: asIdString(r.id, `s-${index}`),
    category: asString(r.category),
    level: asStrengthLevel(r.level),
    title: asString(r.title),
    diagnosis: asString(r.diagnosis),
    evidence: asString(r.evidence),
    impact: asString(r.impact),
    leverageAction: asString(r.leverageAction ?? r.leverage_action),
  };
}

/** strength_diagnosis 부재(구 1.0 레코드·진행중)에도 빈 구조를 돌려 화면이 안전히 건너뛴다. */
function mapStrengthDiagnosis(dto: unknown): StrengthDiagnosis {
  const r = asRecord(dto);
  const noStrength = asRecord(r.noStrengthDiagnosis ?? r.no_strength_diagnosis);
  return {
    oneLineVerdict: asString(r.oneLineVerdict ?? r.one_line_verdict),
    strengths: asArray(r.strengths).map((s, i) => mapStrength(s, i)),
    noStrengthDiagnosis: {
      hasIssue: asBoolean(noStrength.hasIssue ?? noStrength.has_issue),
      reason: asString(noStrength.reason),
      improvementDirection: asString(
        noStrength.improvementDirection ?? noStrength.improvement_direction,
      ),
    },
    standoutExperienceTypes: asStringArray(
      r.standoutExperienceTypes ?? r.standout_experience_types,
    ),
    contentQualityHighlights: asArray(
      r.contentQualityHighlights ?? r.content_quality_highlights,
    ).map(mapContentQualityHighlight),
    competitorAdvantage: asString(r.competitorAdvantage ?? r.competitor_advantage),
  };
}

function mapJobRecommendation(dto: unknown): JobRecommendation {
  const r = asRecord(dto);
  const job: JobRecommendation = {
    company: asString(r.company),
    role: asString(r.role),
    deadline: asString(r.deadline),
    whyMatch: asString(r.whyMatch ?? r.why_match),
    url: asString(r.url),
  };
  // is_valid 는 verified_jobs 에만 붙고 expired_jobs 엔 없다 — 있을 때만 반영한다.
  const isValid = r.isValid ?? r.is_valid;
  if (typeof isValid === "boolean") job.isValid = isValid;
  return job;
}

/**
 * 종합 분석 응답 형태 v2.0 (comprehensive/2.0, prefix 없는 평탄형, result wrapper도 방어):
 * { status, user_school, user_department, brief_summary, detailed_summary,
 *   keyword_clustering, experience_insights, synergy_combinations[],
 *   additional_recommendations{certifications[], clubs_and_societies[], projects_and_contests[]},
 *   resume_star_format[], action_plan, strength_diagnosis, critical_diagnosis,
 *   verified_jobs[], expired_jobs[], missing_info_warning }
 * 구 레코드(valid_job_recommendations, additional_recommendations 문자열 배열)도 폴백 지원.
 */
function mapComprehensiveDetail(dto: unknown): ComprehensiveAnalysisResult {
  const r = asRecord(dto);
  const body = r.result && typeof r.result === "object" ? asRecord(r.result) : r;

  const clustering = asRecord(body.keywordClustering ?? body.keyword_clustering);
  const insights = asRecord(body.experienceInsights ?? body.experience_insights);
  const additional = asRecord(body.additionalRecommendations ?? body.additional_recommendations);
  const diagnosis = asRecord(body.criticalDiagnosis ?? body.critical_diagnosis);

  const detail = {
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
      certifications: asArray(additional.certifications).map(mapCertification),
      clubsAndSocieties: asArray(
        additional.clubsAndSocieties ?? additional.clubs_and_societies,
      ).map(mapClubSociety),
      projectsAndContests: asArray(
        additional.projectsAndContests ?? additional.projects_and_contests,
      ).map(mapProjectContest),
    },
    resumeStarFormat: asArray(
      body.resumeStarFormat ?? body.resume_star_format,
    ).map(mapStarFormat),
    actionPlan: mapActionPlan(body.actionPlan ?? body.action_plan),
    strengthDiagnosis: mapStrengthDiagnosis(
      body.strengthDiagnosis ?? body.strength_diagnosis,
    ),
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
    // v2.0: 채용공고는 후처리로 verified/expired 로 분리돼 온다. 구 레코드(valid_job_recommendations)는
    // 마감 판정 전이므로 verifiedJobs 로 폴백한다(이중호환).
    verifiedJobs: asArray(
      body.verifiedJobs ?? body.verified_jobs ??
        body.validJobRecommendations ?? body.valid_job_recommendations,
    ).map(mapJobRecommendation),
    expiredJobs: asArray(body.expiredJobs ?? body.expired_jobs).map(mapJobRecommendation),
    missingInfoWarning: asString(body.missingInfoWarning ?? body.missing_info_warning),
  };

  return {
    ...detail,
    // id·status·isBookmarked·experiences 는 result 밖 엔벨로프에서 오는 메타다 —
    // 판정에서 빼야 본문 없이 경험 배지만 뜨는 화면을 "본문 있음"으로 오판하지 않는다.
    hasResultBody: hasAnyContent({
      ...detail,
      id: "",
      status: "",
      isBookmarked: false,
      experiences: [],
    }),
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

/** C_coverage 원본에 high/medium/low 카운트 필드가 하나라도 명시돼 있는지. */
function hasExplicitCoverageCounts(raw: unknown): boolean {
  const r = asRecord(raw);
  return (
    r.highCount !== undefined ||
    r.high_count !== undefined ||
    r.mediumCount !== undefined ||
    r.medium_count !== undefined ||
    r.lowCount !== undefined ||
    r.low_count !== undefined
  );
}

/**
 * C_coverage 가 총계·비율만 주고 high/medium/low 카운트를 안 줄 때(v4.1 과도기),
 * D_matched_experiences 의 relevance 로 키워드별 카운트를 파생한다.
 * 카운트 필드가 원본에 하나라도 명시돼 있으면(값이 0 이어도) 백엔드 값을 그대로 신뢰한다.
 * ⚠️ 매핑 후 값(0)으로 판단하면 명시적 {0,0,0}(백엔드의 권위 있는 무커버리지 신호)과
 * 필드 부재를 구분 못 해 파생이 덮어쓰므로, 원본 rawCoverage 로 "존재"를 판정한다.
 * rawCoverage[i] 는 coverage[i] 와 1:1 (coverage = rawCoverage.map(mapKeywordCoverage)).
 */
function fillCoverageCounts(
  coverage: KeywordCoverage[],
  groups: KeywordMatchedGroup[],
  rawCoverage: unknown[],
): KeywordCoverage[] {
  return coverage.map((c, i) => {
    if (hasExplicitCoverageCounts(rawCoverage[i])) return c;
    const group = groups.find((g) => g.keyword === c.keyword);
    if (!group) return c;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    for (const exp of group.experiences) {
      // relevance 는 원본 문자열이라 대소문자가 섞여 올 수 있다(UI 도 조회 시 toLowerCase 로
      // 정규화한다). 파생 카운트도 같은 규칙으로 맞춰 "High" 가 누락되지 않게 한다.
      const rel = exp.relevance.toLowerCase();
      if (rel === "high") highCount += 1;
      else if (rel === "medium") mediumCount += 1;
      else if (rel === "low") lowCount += 1;
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
    // UI 가 relevance 를 toLowerCase 로 조회하므로 파생도 같은 규칙으로 정규화한다("Low" 포함).
    isReferenceOnly: asBoolean(
      r.isReferenceOnly ?? r.is_reference_only ?? asString(r.relevance).toLowerCase() === "low",
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
    // 레거시 객체형({ description }/{ text }/{ content }/{ suggestion }/{ recommendation })도
    // 흡수해 항목이 빈값으로 걸러지지 않게 한다(제거된 coerceImprovementText 커버 범위 유지).
    // reason·priority 는 이 타입의 별도 필드라 폴백에서 제외한다(중복 소비 방지).
    howToAdd: asString(
      r.howToAdd ?? r.how_to_add ?? r.description ?? r.text ?? r.content ?? r.suggestion ?? r.recommendation,
    ),
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
    // 레거시 객체형 텍스트 필드({ content }/{ recommendation } 포함)도 흡수한다
    // (제거된 coerceImprovementText 커버 범위 유지 — 형제 매퍼와 동일하게).
    gapDescription: asString(
      r.gapDescription ?? r.gap_description ?? r.description ?? r.text ?? r.content ?? r.suggestion ?? r.recommendation,
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
  // 구버전 객체형은 {description}뿐 아니라 {text}/{content}/{suggestion}/{reason} 로도 왔다
  // (구 coerceImprovementText 커버 범위). description/recommendation 만 보면 그 형태가 빈
  // 카드가 되므로 형제 매퍼(정보보강·경험확장)와 동일하게 텍스트 폴백을 모두 흡수한다.
  const legacy =
    typeof dto === "string"
      ? dto
      : asString(
          r.description ?? r.text ?? r.content ?? r.suggestion ?? r.reason ?? r.recommendation,
        );
  return {
    keyword: asString(r.keyword),
    recommendations: legacy ? [{ type: "", title: legacy, expectedEffect: "" }] : [],
  };
}

// 키워드 분석 본문(A-F)이 이 껍질에 알맹이와 함께 들어있는지 판별한다. 이중중첩 언랩의 종료 조건.
const KEYWORD_CONTENT_KEYS = [
  "keywordDefinitions", "keyword_definitions", "A_keyword_definitions",
  "selectionCriteria", "selection_criteria", "B_selection_criteria",
  "coverage", "C_coverage",
  "matchedExperiences", "matched_experiences", "D_matched_experiences",
  "storylines", "E_storylines",
  "improvementGuide", "improvement_guide", "F_improvement_guide",
];

/**
 * 키가 있는지가 아니라 **값이 차 있는지**를 본다(FRT-134).
 * 키 존재만 보면 중간 래퍼에 빈 A~F 키가 섞여 있을 때 언랩이 거기서 멈춰,
 * 한 겹 더 안쪽에 있는 진짜 본문을 통째로 잃는다 — 화면은 결과가 있는데도 비어버린다.
 */
function hasKeywordContent(body: UnknownRecord): boolean {
  return KEYWORD_CONTENT_KEYS.some((k) => hasAnyContent(body[k]));
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
  // result 래퍼가 있으면 우선 한 겹 벗긴다. 단 통째 교체가 아니라 얕게 병합한다 —
  // 신형 응답은 result 옆에 keywords·target·status 등 메타를 함께 싣는데(계약 §2.3),
  // 교체하면 그 메타가 사라져 헤더가 generic 이 되고 타깃 시나리오가 누락된다.
  // 이중중첩 루프와 동일하게 안쪽 본문이 충돌 키를 이긴다.
  if (body.result && typeof body.result === "object" && !Array.isArray(body.result)) {
    body = { ...body, ...asRecord(body.result) };
  }
  // 본문이 여전히 안 보이고 안쪽에 또 result 객체가 있으면(이중중첩) 병합해 뚫는다.
  // 첫 병합이 이미 한 겹 소비했으므로 나머지 깊이(MAX_RESULT_NESTING - 1)만큼 더 뚫는다 —
  // assertRenderableSchema 의 검사 깊이와 같은 상수에서 파생해 어긋나지 않게 한다.
  let guard = 0;
  while (
    !hasKeywordContent(body) &&
    body.result &&
    typeof body.result === "object" &&
    !Array.isArray(body.result) &&
    guard < MAX_RESULT_NESTING - 1
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
  const rawCoverage = asArray(body.coverage ?? body.C_coverage);
  const coverage = fillCoverageCounts(
    rawCoverage.map(mapKeywordCoverage),
    matchedExperiences,
    rawCoverage,
  );

  const detail = {
    id: asString(r.id ?? body.id),
    status: mapStatus(r.status ?? body.status),
    isBookmarked: asBoolean(r.isBookmarked ?? r.is_bookmarked ?? body.isBookmarked ?? body.is_bookmarked),
    analysisDate: asString(
      r.createdAt ?? r.created_at ?? body.createdAt ?? body.created_at ??
        body.analysisDate ?? body.analysis_date,
    ),
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

  return {
    ...detail,
    // 본문 키가 "있는지"(hasKeywordContent, 언랩 종료 조건)와 "그릴 값이 있는지"는 다른 질문이다 —
    // A_keyword_definitions: [] 처럼 키만 오면 언랩은 끝나지만 화면은 여전히 비어 있다.
    // 화면 기준으로 판정하되, 껍질 메타(keywords·target·mode·date, 계약 §2.3)는 뺀다 —
    // 본문 없이도 실려 오므로 포함하면 빈 화면을 "본문 있음"으로 오판한다.
    hasResultBody: hasAnyContent({
      ...detail,
      id: "",
      status: "",
      isBookmarked: false,
      analysisDate: "",
      analysisMode: "",
      keywords: [],
      targetScenario: "",
    }),
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
 * 서버는 `{ status, message, data: { id, title } }` 로 답한다 — 생성된 분석 id 가 `data.id`
 * 에 실린다(arc-backend dev `PostSuccessResponse(data=UUIDDataWithTitle(...))` 확인).
 * 초기 스펙(FRT-38)은 `{ status, message }`만 반환해 id 가 없었고, 그때의 방어 경로를 그대로
 * 남겨 둔다 — 부재 시 `analysisId: null` 이며, 호출부는 이를 오류가 아니라 "큐 적재됨"으로 보고
 * 목록으로 안내한다. (id 없이 목록에서 폴링 대상을 추측하는 우회는 race 때문에 하지 않는다.)
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

/**
 * POST /analysis/comprehensive/{analysisId}/retry — 실패한 분석 재실행 (FRT-108 / BAC-42)
 *
 * body 를 보내지 않는다. 서버가 보관 중인 원 파라미터(experience_ids)를 그대로 재사용한다
 * — 프런트가 되돌려 보내면 그 사이 삭제된 경험 때문에 400 이 난다.
 * 새 행이 아니라 같은 레코드를 재실행하므로(status failed → queued) 응답의 id 는 원 id 와
 * 같다. 호출부가 이미 id 를 알고 있어 반환하지 않는다.
 *
 * 실패는 삼키지 않고 ApiError 로 그대로 throw 한다 — 409(실패 상태가 아님)/404/429 를
 * 호출부가 구분해 안내할 수 있어야 한다.
 *
 * ⚠️ 이 함수는 기능 플래그를 모른다(flag-agnostic). 노출 게이팅은 목록 페이지(호출부)가
 * `isAnalysisRetryEnabled()` 로 수행한다 — 버튼 컴포넌트도 플래그를 모른다.
 */
export async function retryComprehensiveAnalysis(
  analysisId: string,
): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  await api.post<ApiSuccessResponse<unknown>>(
    `/analysis/comprehensive/${analysisId}/retry`,
  );
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
 * 서버는 `{ status, message, data: { id, title } }` 로 답한다 — 생성된 분석 id 가 `data.id`
 * 에 실린다(arc-backend dev `PostSuccessResponse(data=UUIDDataWithTitle(...))` 확인).
 * 초기 스펙(FRT-38)은 `{ status, message }`만 반환해 id 가 없었고, 그때의 방어 경로를 그대로
 * 남겨 둔다 — 부재 시 `analysisId: null` 이며, 호출부는 이를 오류가 아니라 "큐 적재됨"으로 보고
 * 목록으로 안내한다. (id 없이 목록에서 폴링 대상을 추측하는 우회는 race 때문에 하지 않는다.)
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

/**
 * POST /analysis/keyword/{analysisId}/retry — 실패한 분석 재실행 (FRT-108 / BAC-42)
 * 계약·주의사항은 retryComprehensiveAnalysis 참고 (원 파라미터는 keywords + target).
 */
export async function retryKeywordAnalysis(analysisId: string): Promise<void> {
  if (shouldMock()) return mock(async () => undefined);
  await api.post<ApiSuccessResponse<unknown>>(
    `/analysis/keyword/${analysisId}/retry`,
  );
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
 * `/analysis/home/summary` 엔드포인트가 없으므로 세 목록 + 경험 목록을 병렬 fetch 후 집계한다.
 *
 * 일부 소스가 실패해도 나머지는 그대로 보여준다(회복력). 다만 그 회복이 무음이면 살아남은
 * 소스만으로 계산된 통계가 "전체"인 얼굴을 하므로, 무엇을 못 불러왔는지 함께 돌려
 * 화면이 숫자를 믿을지 말지 말할 수 있게 한다(FRT-169).
 */
export async function getAnalysisHomeSummary(): Promise<AnalysisHomeSummary> {
  if (shouldMock())
    return mock(async () => (await mocks()).mockAnalysisHomeSummary);

  // 실패 유형은 이 **선언 순서**에서 파생한다 — catch 안에서 push 하면 어느 요청이 먼저
  // 깨지느냐에 따라 순서가 바뀌어 안내 문구가 요청마다 뒤바뀐다.
  const sources: { type: AnalysisType; load: () => Promise<AnalysisSnapshot[]> }[] = [
    { type: "individual", load: () => getIndividualAnalysisList() },
    { type: "comprehensive", load: () => getComprehensiveList() },
    { type: "keyword", load: () => getKeywordList() },
  ];

  type ExperienceListData = Awaited<ReturnType<typeof getExperiences>>;
  const [settled, experiencesSettled] = await Promise.all([
    Promise.all(
      sources.map((s) =>
        s.load().then(
          (items) => ({ ok: true, items }),
          () => ({ ok: false, items: [] as AnalysisSnapshot[] }),
        ),
      ),
    ),
    getExperiences().then(
      (data) => ({ ok: true, data }),
      () => ({ ok: false, data: { count: 0, contents: [] } as ExperienceListData }),
    ),
  ]);

  const failedTypes = sources.filter((_, i) => !settled[i].ok).map((s) => s.type);
  const experiencesFailed = !experiencesSettled.ok;

  // 넷 다 실패했을 때만 에러를 전파한다 — 분석 3종만 실패하고 경험이 살아 있으면
  // 기존에도 던지지 않았고, 그 경계는 그대로 보존한다.
  if (failedTypes.length === sources.length && experiencesFailed) {
    throw new Error("분석 데이터를 불러올 수 없습니다.");
  }

  const [individual, comprehensive, keyword] = settled.map((r) => r.items);
  const experiencesData = experiencesSettled.data;

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
    failedTypes,
    experiencesFailed,
  };
}

export interface AnalysisHistoryResult {
  items: AnalysisSnapshot[];
  /**
   * 병합 소스 중 불러오지 못한 분석 유형. 전부 실패하면 throw 하므로 최대 2개다.
   * 불리언이 아니라 유형 배열인 이유: "일부를 못 불러왔다"만으로는 *무엇이* 빠졌는지
   * 말할 수 없어, 사용자가 그 유형의 기록이 삭제됐다고 오인하는 것을 막지 못한다(FRT-170).
   */
  failedTypes: AnalysisType[];
}

/**
 * `/analysis/history` 엔드포인트가 없으므로 세 목록을 병합해 반환한다.
 *
 * 일부 소스가 실패해도 나머지는 그대로 보여준다(회복력). 다만 그 회복이 무음이면 살아남은
 * 목록이 "전체 기록"인 얼굴을 하므로, 실패한 유형을 함께 돌려 화면이 말할 수 있게 한다.
 */
export async function getAnalysisHistory(params?: {
  type?: string;
  sort?: "newest" | "oldest";
}): Promise<AnalysisHistoryResult> {
  if (shouldMock())
    return mock(async () => {
      const { mockHistory } = await mocks();
      let result = [...mockHistory];
      if (params?.type && params.type !== "all")
        result = result.filter((s) => s.type === params.type);
      if (params?.sort === "oldest") result.reverse();
      return { items: result, failedTypes: [] };
    });

  // 실패 유형은 이 **선언 순서**에서 파생한다 — catch 안에서 push 하면 어느 요청이 먼저
  // 깨지느냐에 따라 순서가 바뀌어 안내 문구가 요청마다 뒤바뀐다.
  const sources: { type: AnalysisType; load: () => Promise<AnalysisSnapshot[]> }[] = [
    { type: "individual", load: () => getIndividualAnalysisList() },
    { type: "comprehensive", load: () => getComprehensiveList() },
    { type: "keyword", load: () => getKeywordList() },
  ];

  const settled = await Promise.all(
    sources.map((s) =>
      s.load().then(
        (items) => ({ ok: true, items }),
        () => ({ ok: false, items: [] as AnalysisSnapshot[] }),
      ),
    ),
  );
  const failedTypes = sources.filter((_, i) => !settled[i].ok).map((s) => s.type);

  // 모든 요청이 실패하면 에러를 전파한다
  if (failedTypes.length === sources.length) {
    throw new Error("분석 기록을 불러올 수 없습니다.");
  }

  let merged = settled
    .flatMap((r) => r.items)
    .filter((s) => s.status === "completed");
  if (params?.type && params.type !== "all") {
    merged = merged.filter((s) => s.type === params.type);
  }
  merged.sort((a, b) => {
    const cmp = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    return params?.sort === "oldest" ? -cmp : cmp;
  });
  return { items: merged, failedTypes };
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

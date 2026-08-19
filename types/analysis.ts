// ─── Enum Types ─────────────────────────────────────────────

import type { ImportanceLevel } from "./archive";

export type AnalysisType = "individual" | "comprehensive" | "keyword";
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type KeywordCategory = "skill" | "work_style" | "value" | "job_domain";
export type { ImportanceLevel };

// ─── Common Structures ──────────────────────────────────────

/**
 * 종합 분석에 포함된 경험 참조 (BAC-58, 계약 §2.2).
 * title 은 경험이 삭제된 경우 null 로 온다 — 빈 문자열과 구분해 "삭제된 경험"으로 표시한다.
 */
export interface ExperienceRef {
  id: string;
  title: string | null;
}

export interface AnalysisSnapshot {
  id: string;
  type: AnalysisType;
  title: string;
  status: AnalysisStatus;
  createdAt: string;
  experienceCount: number;
  isBookmarked: boolean;
  selectedExperienceIds?: string[];
  selectedKeywords?: string[];
  /** 종합 분석 목록에만 실린다 (계약 §2.2). experienceCount 보다 우선한다. */
  experiences?: ExperienceRef[];
}

// ─── Korean Label Mappings ──────────────────────────────────

export const keywordCategoryLabel: Record<KeywordCategory, string> = {
  skill: "직무/스킬",
  work_style: "업무 성향",
  value: "가치관",
  job_domain: "직종/업무",
};

export const analysisTypeLabel: Record<AnalysisType, string> = {
  individual: "개별 분석",
  comprehensive: "종합 분석",
  keyword: "키워드 분석",
};

// ─── Individual Analysis Detail ─────────────────────────────
// 백엔드 응답: { id, status, experience_id, result }
// result 안에 실제 분석 결과 트리가 들어 있다.

// 백엔드 종합·개별 analyzer 공통 severity (comprehensive.py / individual.py: critical|major|minor).
// strength_diagnosis 의 level(outstanding|strong|notable)과 1:1 대응한다(comprehensive.py L825~828).
export type WeaknessSeverity = "critical" | "major" | "minor";
export type SynergyPriority = "high" | "medium" | "low";
export type StrengthLevel = "outstanding" | "strong" | "notable";

/**
 * 개별분석 `item_strengths[].strength_level` 의 등급 (FRT-271).
 *
 * ⚠️ 종합분석의 `StrengthLevel` 과 **어휘가 다르다** — 개별에는 `strong` 이 없고 `moderate` 가 있다
 * (individual.py `outstanding|notable|moderate` vs comprehensive.py `outstanding|strong|notable`).
 * 한 타입으로 합치면 `moderate` 가 "모르는 값"이 되어 조용히 `notable` 로 승격된다.
 */
export type IndividualStrengthLevel = "outstanding" | "notable" | "moderate";

/**
 * ⚠️ `strengths`/`limitations` 는 여기 없다. 백엔드 `deep_analysis` 는 career_value·market_value
 * 뿐이라 두 필드는 늘 빈 배열이었다(FRT-271). 강점은 `itemStrengths`, 한계는
 * `itemDiagnosis.limitations` 가 받는다 — 백엔드가 실제로 값을 두는 자리다.
 */
export interface IndividualDeepAnalysis {
  careerValue: string;
  /**
   * 백엔드는 `applicable_roles` 를 `deep_analysis` **밖 최상위**에 둔다. 화면에서는 심층 분석과
   * 함께 읽히므로 프런트 타입에서는 이 자리를 유지하고, 매퍼가 두 위치를 모두 본다.
   */
  applicableRoles: string[];
  marketValue: string;
}

export interface IndividualStrength {
  id: string;
  category: string;
  level: IndividualStrengthLevel;
  title: string;
  /** 왜 강점인지의 근거 서술 (종합분석 Strength 의 `diagnosis` 자리). */
  analysis: string;
  evidence: string;
  /** 이 강점이 취업·커리어에 주는 실질적 영향 (종합분석의 `impact` 자리). */
  careerImpact: string;
  /** 강점을 극대화할 행동 (동사 시작). */
  leverageAction: string;
  /** Before/After 형식 개선 예시. 백엔드가 null 로 보낼 수 있어 부재는 빈 문자열이다. */
  showcaseExample: string;
}

export interface IndividualItemStrengths {
  hasGenuineStrengths: boolean;
  /** 백엔드 `one_line_strength_verdict`. */
  oneLineVerdict: string;
  /** 강점이 없을 때만 채워지는 사유. */
  noStrengthReason: string;
  summarizedStrengths: string[];
  strengths: IndividualStrength[];
  strongestAsset: string;
  positioningTip: string;
}

export interface IndividualStarFormat {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface IndividualWeakness {
  id: string;
  category: string;
  severity: WeaknessSeverity;
  title: string;
  diagnosis: string;
  evidence: string;
  impact: string;
  priorityAction: string;
  improvementExample: string;
}

export interface IndividualItemDiagnosis {
  oneLineVerdict: string;
  /** 이 항목만으로는 부족한 점. 백엔드는 `item_diagnosis` 안에 둔다(FRT-271). */
  limitations: string[];
  weaknesses: IndividualWeakness[];
  missingElements: string[];
  rewriteSuggestion: string;
}

export interface IndividualSynergyRecommendation {
  priority: SynergyPriority;
  category: string;
  name: string;
  reason: string;
  expectedEffect: string;
  estimatedDuration: string;
}

export interface IndividualActionPlan {
  shortTerm: string;
  midTerm: string;
  longTerm: string;
}

export interface IndividualAnalysisResultBody {
  status: string;
  itemName: string;
  itemType: string;
  briefSummary: string;
  deepAnalysis: IndividualDeepAnalysis;
  starFormat: IndividualStarFormat;
  /** 강점은 진단(약점)보다 먼저 노출한다 — 백엔드 프롬프트의 앵커링 저항 원칙과 같은 순서. */
  itemStrengths: IndividualItemStrengths;
  itemDiagnosis: IndividualItemDiagnosis;
  synergyRecommendations: IndividualSynergyRecommendation[];
  actionPlan: IndividualActionPlan;
  missingInfoWarning: string;
}

export interface IndividualAnalysisResult {
  id: string;
  status: AnalysisStatus;
  experienceId: string;
  isBookmarked: boolean;
  /**
   * 결과 본문이 실제로 도착했는지(FRT-134). false = 화면이 그릴 값이 하나도 없다 —
   * 분석 진행 중·실패라 `result` 가 아직 null 이거나, 형태가 어긋나 언랩이 실패한 경우다.
   * 상세 화면은 이때 조용한 빈 화면 대신 상태 안내로 전환한다.
   */
  hasResultBody: boolean;
  result: IndividualAnalysisResultBody;
}

// 진단/시너지 라벨 — 톤은 압박을 주지 않게(경쟁 지양, CLAUDE.md 제품 원칙).
export const weaknessSeverityLabel: Record<WeaknessSeverity, string> = {
  critical: "시급",
  major: "주의",
  minor: "참고",
};

// 강점 level(outstanding|strong|notable) 라벨. severity 와 1:1 대응하는 긍정 축.
export const strengthLevelLabel: Record<StrengthLevel, string> = {
  outstanding: "탁월",
  strong: "강점",
  notable: "눈에 띔",
};

// 개별분석 전용 등급 라벨 — 종합분석과 어휘가 달라 표도 따로 둔다(FRT-271).
export const individualStrengthLevelLabel: Record<IndividualStrengthLevel, string> = {
  outstanding: "탁월",
  notable: "눈에 띔",
  moderate: "무난",
};

export const synergyPriorityLabel: Record<SynergyPriority, string> = {
  high: "강력 추천",
  medium: "추천",
  low: "참고",
};

// ─── Comprehensive Analysis Detail ──────────────────────────
// 백엔드 응답 v2.0 (comprehensive/2.0, prefix 없는 형태):
// status, user_school, user_department, brief_summary, detailed_summary,
// keyword_clustering, experience_insights, synergy_combinations[],
// additional_recommendations{certifications[], clubs_and_societies[], projects_and_contests[]},
// resume_star_format[], action_plan, strength_diagnosis, critical_diagnosis,
// verified_jobs[], expired_jobs[], missing_info_warning
// (v2.0: strength_diagnosis 신설, valid_job_recommendations 는 후처리로 verified/expired 분리,
//  additional_recommendations 항목은 문자열이 아니라 검증 필드가 붙은 객체다.)
//
// v3.1 (comprehensive_field_spec_v3.1, AI TF 2026-07-29 확정) 추가분 — FRT-208:
//   star_analysis_status{...}, recommendation_notices[],
//   resume_star_format[] 항목에 headline·L·*_source_quote·competency_evidence[]·
//   evidence_status{...}·quality_warning·quality{...},
//   clubs_and_societies[].url_note
// v3.1 이 삭제한 필드(search_query, search_verified, expired_jobs[], verified_jobs[].is_valid)는
// 타입에서 **빼지 않는다** — 백엔드가 아직 v2.0 을 내보내고 있어 제거하면 즉시 회귀다.
// 화면은 schema_version 으로 분기하지 않고 **필드 존재 여부로만** 그린다(계약 §3.5 주석 참고):
// v3.1 명세엔 schema_version 키 자체가 없어 버전 분기를 신뢰할 수 없다.
// 노출하지 않기로 한 v3.1 필드(guard_version, verification_audit, rejected_by_guard)는
// 타입에도 넣지 않는다 — 특히 guard_version 은 hasResultBody 판정을 오염시킨다(analysis-api.ts).

export interface KeywordClustering {
  personalityTendency: string[];
  coreCompetency: string[];
  jobIndustry: string[];
}

export interface ExperienceInsights {
  motivation: string;
  learningPoints: string;
}

export interface SynergyCombination {
  combinationTitle: string;
  items: string[];
  synergyReason: string;
  expectedEffect: string;
  applicableRoles: string[];
}

// 추가 활동 추천 — v2.0 은 검증(verify_*) 후 url·issuer·search_verified 등이 붙은 객체 배열이다.
// url 은 검증 미통과 시 null 로 온다(빈 문자열로 뭉개지 않는다).
export interface Certification {
  name: string;
  reason: string;
  expectedEffect: string;
  estimatedDuration: string;
  /** verify_certifications_with_search 통과 시 공식 URL, 아니면 null. */
  url: string | null;
  /** 검증으로 확인된 주관기관 (프롬프트 단계엔 없고 후처리로 추가). */
  issuer: string;
}

export interface ClubSociety {
  name: string;
  /** 교내동아리|교내학회|연합동아리|연합학회|외부학교 등. enum 강제 대신 원문 유지. */
  type: string;
  schoolAffiliation: string;
  description: string;
  reason: string;
  expectedEffect: string;
  url: string | null;
  searchQuery: string;
  searchVerified: boolean;
  /**
   * v3.1 신설. url 이 null 일 때만 온다("직접 확인하십시오: {검색어}").
   * 지금은 링크 검증에 실패하면 화면에서 링크가 조용히 사라질 뿐이라, 이 안내가 그 자리를 채운다.
   */
  urlNote: string;
}

export interface ProjectContest {
  name: string;
  organizer: string;
  reason: string;
  expectedEffect: string;
  url: string | null;
  /** 마감일 (YYYY-MM-DD) 또는 미확인 시 null. */
  deadline: string | null;
  isRegular: boolean;
}

export interface AdditionalRecommendations {
  certifications: Certification[];
  clubsAndSocieties: ClubSociety[];
  projectsAndContests: ProjectContest[];
}

export interface ContentQualityIssue {
  item: string;
  issue: string;
  improvementHint: string;
}

// ── 강점 진단 (v2.0 신설, critical_diagnosis 보다 먼저 출력) ──
export interface ContentQualityHighlight {
  item: string;
  highlight: string;
  whyEffective: string;
}

export interface Strength {
  id: string;
  category: string;
  level: StrengthLevel;
  title: string;
  diagnosis: string;
  evidence: string;
  impact: string;
  /** 강점을 극대화할 행동 (동사 시작). */
  leverageAction: string;
}

export interface NoStrengthDiagnosis {
  hasIssue: boolean;
  reason: string;
  improvementDirection: string;
}

export interface StrengthDiagnosis {
  oneLineVerdict: string;
  strengths: Strength[];
  noStrengthDiagnosis: NoStrengthDiagnosis;
  standoutExperienceTypes: string[];
  contentQualityHighlights: ContentQualityHighlight[];
  competitorAdvantage: string;
}

export interface ComprehensiveWeakness {
  id: string;
  category: string;
  severity: WeaknessSeverity;
  title: string;
  diagnosis: string;
  evidence: string;
  impact: string;
  priorityAction: string;
}

export interface CriticalDiagnosis {
  oneLineVerdict: string;
  weaknesses: ComprehensiveWeakness[];
  missingExperienceTypes: string[];
  contentQualityIssues: ContentQualityIssue[];
  competitorGap: string;
}

export interface JobRecommendation {
  company: string;
  role: string;
  deadline: string;
  whyMatch: string;
  url: string;
  /**
   * 마감일 유효 여부 — 코드 판정(filter_valid_jobs). verified_jobs 항목엔 true 로 붙고
   * expired_jobs 항목엔 키 자체가 없어 undefined 로 온다(spec 문서의 "동일 구조"와 불일치).
   * 마감 여부의 정본은 이 필드가 아니라 verifiedJobs/expiredJobs 배열 소속이다.
   */
  isValid?: boolean;
}

// ── v3.1 STAR: 근거 결속 + 품질 채점 (FRT-208) ──────────────
// v2.0 은 데이터가 부족해도 예시 문구로 STAR 를 채웠다. v3.1 은 근거가 없으면 슬롯을 null 로
// 비우고, A·R 근거가 둘 다 없으면 항목 자체를 폐기하며, 아무것도 못 만들면 배열을 통째로 비운다.
// 그래서 "왜 없는지"가 star_analysis_status 로 따로 온다 — 배열만 보면 화면이 이유를 말할 수 없다.

export type StarQualityGrade = "A" | "B" | "C" | "D";

/** 등급 라벨. 압박을 주지 않는 톤(CLAUDE.md 제품 원칙) — 등급 문자는 배지로 따로 보인다. */
export const starQualityGradeLabel: Record<StarQualityGrade, string> = {
  A: "충분해요",
  B: "괜찮아요",
  C: "다듬으면 좋아요",
  D: "보완이 필요해요",
};

export interface StarCompetencyEvidence {
  competency: string;
  why: string;
}

export interface StarUnsupportedSlot {
  /** 슬롯 키 (S·T·A·R·L). */
  slot: string;
  label: string;
  reason: string;
  /** 근거로 주장됐으나 원문 대조에 실패한 인용문. 없을 수 있다. */
  claimedQuote: string;
}

export interface StarEvidenceStatus {
  /** 원문 근거를 확보한 슬롯 (예: ["S","A","R"]). */
  supportedSlots: string[];
  unsupportedSlots: StarUnsupportedSlot[];
  /** 슬롯 간 인용 중복도가 60% 이상 — 새로 쓴 게 아니라 입력을 재배치한 수준이라는 신호. */
  restructuringOnly: boolean;
  /** 어느 슬롯 쌍이 얼마나 겹치는지 (예: ["S↔T (82% 중복)"]). */
  restructuringDetail: string[];
}

export interface StarQualityCriterion {
  /** 루브릭 ID (action_dominant·context_concise 등 10종). enum 강제 대신 원문 유지. */
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  /** passed=false 일 때만 온다. */
  coaching: string;
}

export interface StarQuality {
  /**
   * 10개 루브릭 통과율 기준 등급. **모르는 값은 null** — 임의로 낮게 잡으면 사용자에게
   * 부당한 평가가 된다(약점 severity 가 major 로 올려 잡는 것과 반대 방향이다).
   */
  grade: StarQualityGrade | null;
  /** "7/10" 형식. */
  score: string;
  verdict: string;
  criteria: StarQualityCriterion[];
  /** 미달 기준의 coaching 상위 3개. */
  priorityFixes: string[];
  /** headline·L 이 삭제된 경우의 사유. */
  derivedFieldNotes: string[];
}

/** 슬롯별 원문 근거 인용. 값이 없으면 빈 문자열. */
export interface StarSourceQuotes {
  situation: string;
  task: string;
  action: string;
  result: string;
  learning: string;
}

/**
 * 종합분석 STAR 항목. v2.0(title + S/T/A/R)과 v3.1(headline·L·근거·품질) 이중호환 —
 * v3.1 필드가 없으면 전부 빈 값이라 화면이 v2.0 과 동일하게 그려진다.
 * 개별분석의 star_format 은 이 확장 대상이 아니라 IndividualStarFormat 그대로다.
 */
export interface ComprehensiveStarFormat extends IndividualStarFormat {
  /** 이력서용 한 줄 성취문. 원문에 없는 수치가 섞이면 백엔드가 삭제해 빈 값으로 온다. */
  headline: string;
  /** L — 배움·회고(STARR). 원문에 배움이 명시된 경우에만 온다(추측성 회고는 백엔드가 삭제). */
  learning: string;
  sourceQuotes: StarSourceQuotes;
  competencyEvidence: StarCompetencyEvidence[];
  evidenceStatus: StarEvidenceStatus;
  /** restructuringOnly=true 일 때만 온다. */
  qualityWarning: string;
  quality: StarQuality;
}

export interface StarRejectedEntry {
  title: string;
  reason: string;
  unsupportedSlots: string[];
  coaching: string;
}

export interface StarQualityReview {
  evaluated: number;
  /** 등급별 개수 (예: {"A":1,"D":1}). */
  gradeDistribution: Record<string, number>;
  portfolioVerdict: string;
  topFixes: string[];
}

export interface StarAnalysisStatus {
  /**
   * 응답에 star_analysis_status 가 **실제로 왔는지**. v2.0 응답엔 이 섹션이 아예 없어
   * generated 가 방어 파싱 기본값 false 로 떨어지는데, 그걸 "만들지 못했다"로 읽으면
   * v2.0 사용자에게 이유가 빈 안내가 뜬다 — 부재와 미생성은 다른 사건이다(FRT-169 교훈).
   */
  present: boolean;
  generated: boolean;
  /** 미생성 사유. generated=false 일 때 채워진다. */
  reason: string;
  /** 원문에서 식별한 경험 단위 개수. */
  experienceBlockCount: number;
  /** 5개 신호(분량·행동동사·수치·기간·역할) 중 4개 이상을 충족한 블록 수. */
  starEligibleBlockCount: number;
  /** 어떻게 적으면 STAR 가 가능해지는지. 미생성 시 채워진다. */
  coaching: string[];
  /** 근거 결속에 실패해 폐기된 항목. */
  rejectedEntries: StarRejectedEntry[];
  /** 포트폴리오 전체 품질 총평. 생성된 항목이 없으면 null. */
  qualityReview: StarQualityReview | null;
}

export interface ComprehensiveAnalysisResult {
  id: string;
  status: AnalysisStatus;
  isBookmarked: boolean;
  /**
   * 결과 본문이 실제로 도착했는지(FRT-134). 판정에서 `experiences` 는 제외한다 —
   * 경험 참조는 result 밖 엔벨로프에서 오므로(계약 §3.6) 포함하면 본문 없이 경험 배지만
   * 뜨는 화면이 "본문 있음"으로 오판된다.
   */
  hasResultBody: boolean;
  /** 분석에 포함된 경험 (계약 §2.2·§3.6). 삭제된 경험은 title=null. */
  experiences: ExperienceRef[];
  userSchool: string;
  userDepartment: string;
  briefSummary: string;
  detailedSummary: string;
  keywordClustering: KeywordClustering;
  experienceInsights: ExperienceInsights;
  synergyCombinations: SynergyCombination[];
  additionalRecommendations: AdditionalRecommendations;
  resumeStarFormat: ComprehensiveStarFormat[];
  /**
   * v3.1 신설. STAR 를 만들었는지·못 만들었다면 왜인지. 배열이 비었을 때 화면이
   * 침묵하지 않게 하는 유일한 근거다(v2.0 응답에선 present=false).
   */
  starAnalysisStatus: StarAnalysisStatus;
  actionPlan: IndividualActionPlan;
  /** v2.0 신설. critical_diagnosis 보다 먼저 노출한다(앵커링 저항, 계약/프롬프트). */
  strengthDiagnosis: StrengthDiagnosis;
  criticalDiagnosis: CriticalDiagnosis;
  /** 마감 유효 채용 공고 (verified_jobs). */
  verifiedJobs: JobRecommendation[];
  /**
   * 마감 지난 채용 공고 (expired_jobs). 화면에서 약화 표기한다.
   * v3.1 은 마감 공고를 생성 단계에서 걸러 이 배열이 늘 비지만, v2.0 백엔드가 아직
   * 보내고 있으므로 제거하지 않는다.
   */
  expiredJobs: JobRecommendation[];
  /**
   * v3.1 신설. 추천 카테고리가 빈 이유("확실한 항목이 없어 넣지 않았다" 등).
   * 지금은 빈 카테고리가 조용히 사라져 사용자가 이유를 알 수 없다.
   */
  recommendationNotices: string[];
  missingInfoWarning: string;
}

// ─── Keyword Analysis Detail ────────────────────────────────
// 백엔드 응답: { status, analysis_date, keywords[], target_scenario, keyword_definitions[], ... }

export interface KeywordSuggestion {
  id: string;
  label: string;
  category: KeywordCategory;
  reason: string;
  relatedExperienceCount: number;
}

// A_keyword_definitions[].compliance_criteria[] — 부합 판단 기준(v4.1 명세 #9~11).
// id 는 D_matched_experiences.matched_criteria 가 참조하는 식별 번호(1부터).
export interface ComplianceCriterion {
  id: number;
  criterion: string;
  signalDescription: string;
}

export interface KeywordDefinition {
  keyword: string;
  definition: string;
  synonyms: string[];
  complianceCriteria: ComplianceCriterion[];
}

export interface KeywordSelectionCriteria {
  summary: string;
  criteria: string[];
}

export interface KeywordCoverage {
  keyword: string;
  relatedCount: number;
  totalCount: number;
  coveragePercent: number;
  // v4.1: relevance 등급별 개수(코드 재집계)
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface KeywordEvidence {
  type: string;
  content: string;
  sourceQuote: string;
}

export interface MatchedExperience {
  careerTitle: string;
  organization: string;
  period: string;
  relevance: string; // high | medium | low
  relevanceSummary: string; // v4.1
  evidence: KeywordEvidence[];
  // v4.1: compliance_criteria[].id 참조 배열(number). 구버전 백엔드가 서술 문자열로
  // 보내면 그 문자열을 보존한다(조인 불가 시 뱃지로 직접 표시).
  matchedCriteria: (number | string)[];
  confidence: string;
  confidenceReason: string;
  isReferenceOnly: boolean; // v4.1: relevance=low 자동 태그 → [참고용]
}

export interface KeywordMatchedGroup {
  keyword: string;
  experiences: MatchedExperience[];
}

export interface KeywordStorylineStructure {
  start: string;
  development: string;
  evidence: string;
  growth: string;
  destination: string;
}

export interface StorylineChronoItem {
  order: number;
  experience: string;
  period: string;
  isDated: boolean;
}

export interface StorylineTurningPoint {
  experience: string;
  period: string;
  trigger: string;
  whatChanged: string;
}

export interface StorylineConnectiveLogic {
  fromExperience: string;
  toExperience: string;
  relationType: string; // 인과 | 심화 | 반성 | 확장
  connection: string;
  temporalNote: string | null;
}

export interface KeyQuote {
  careerTitle: string;
  quote: string;
}

export interface KeywordStoryline {
  keyword: string;
  storylineTitle: string;
  tagline: string; // v4.1
  timelineStatus: string; // v4.1: 시간순_확인됨 | 일부_불명확 | 대부분_불명확
  timelineNote: string | null; // v4.1
  chronologicalSequence: StorylineChronoItem[]; // v4.1
  narrative: string; // v4.1
  turningPoints: StorylineTurningPoint[]; // v4.1
  connectiveLogic: StorylineConnectiveLogic[]; // v4.1
  structure: KeywordStorylineStructure;
  usedExperiences: { core: string[]; supporting: string[] };
  keyQuotes: KeyQuote[]; // v4.1: 객체 배열
}

export interface ImprovementOverallDirection {
  currentProfileSummary: string;
  shortTerm: string;
  midTerm: string;
  priorityKeyword: string;
  priorityReason: string;
}

export interface InformationEnhancement {
  target: string;
  missing: string;
  howToAdd: string;
  reason: string;
  priority: string; // 높음 | 중간 | 낮음
}

export interface ExperienceExpansion {
  gapDescription: string;
  suggestedExperienceType: string;
  whyHelpful: string;
  examples: string[];
  priority: string;
}

export interface KeywordRecommendationItem {
  type: string; // 확장 | 보완
  title: string;
  expectedEffect: string;
}

export interface KeywordSpecificRecommendation {
  keyword: string;
  recommendations: KeywordRecommendationItem[];
}

export interface KeywordImprovementGuide {
  overallDirection: ImprovementOverallDirection | null; // v4.1 신설
  informationEnhancement: InformationEnhancement[];
  experienceExpansion: ExperienceExpansion[];
  keywordSpecificRecommendations: KeywordSpecificRecommendation[];
}

export interface KeywordAnalysisResult {
  id: string;
  status: AnalysisStatus;
  isBookmarked: boolean;
  /**
   * 결과 본문(A~F)이 실제로 도착했는지(FRT-134). 판정에서 `keywords`·`targetScenario` 는
   * 제외한다 — 둘 다 result 밖 껍질 메타라(계약 §2.3) 본문 없이도 실려 온다.
   */
  hasResultBody: boolean;
  analysisDate: string;
  analysisMode: string; // v4.1: knn | llm
  keywords: string[];
  targetScenario: string;
  keywordDefinitions: KeywordDefinition[];
  selectionCriteria: KeywordSelectionCriteria;
  coverage: KeywordCoverage[];
  matchedExperiences: KeywordMatchedGroup[];
  storylines: KeywordStoryline[];
  improvementGuide: KeywordImprovementGuide;
}

// ─── Selectable Experience ─────────────────────────────────

export interface SelectableExperience {
  id: string;
  title: string;
  type: string;
  importance: number;
  isComplete: boolean;
}

// ─── Shared Constants ──────────────────────────────────────

export const ANALYSIS_DETAIL_PATH: Record<AnalysisType, string> = {
  individual: "/analysis/individual",
  comprehensive: "/analysis/comprehensive",
  keyword: "/analysis/keyword",
};

export const ANALYSIS_TYPE_FILTERS: { key: "all" | AnalysisType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "individual", label: "개별" },
  { key: "comprehensive", label: "종합" },
  { key: "keyword", label: "키워드" },
];

// ─── Analysis Home Summary ──────────────────────────────────

export interface AnalysisHomeSummary {
  stats: {
    totalExperiences: number;
    analysisCompleted: number;
    lastAnalysisAt: string;
  };
  recentIndividual: AnalysisSnapshot[];
  recentComprehensive: AnalysisSnapshot[];
  recentKeyword: AnalysisSnapshot[];
  recommendations: {
    experienceGroups: { experienceIds: string[]; reason: string }[];
    suggestedKeywords: KeywordSuggestion[];
  };
  /**
   * 병합 소스 중 불러오지 못한 분석 유형. 넷(분석 3종 + 경험 목록)이 전부 실패하면
   * throw 하므로 최대 3개다. 불리언이 아니라 유형 배열인 이유는 [[FRT-170]]과 같다 —
   * *무엇이* 빠졌는지 말하지 못하면 그 유형이 삭제됐다는 오인을 끊을 수 없다.
   */
  failedTypes: AnalysisType[];
  /**
   * 경험 목록 실패 여부. AnalysisType 유니온에 넣지 않고 별도 플래그로 두는 이유:
   * totalExperiences 는 탭과 무관한 상단 통계라, failedTypes 에 섞으면 화면의 탭 교집합
   * 로직에 "경험 탭"이라는 존재하지 않는 개념이 생긴다.
   */
  experiencesFailed: boolean;
}

// ─── Bookmark Extension ─────────────────────────────────────

export interface BookmarkedSnapshot extends AnalysisSnapshot {
  bookmarkedAt: string;
}

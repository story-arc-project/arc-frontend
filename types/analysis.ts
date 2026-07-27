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

export interface IndividualDeepAnalysis {
  careerValue: string;
  strengths: string[];
  limitations: string[];
  applicableRoles: string[];
  marketValue: string;
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
  resumeStarFormat: IndividualStarFormat[];
  actionPlan: IndividualActionPlan;
  /** v2.0 신설. critical_diagnosis 보다 먼저 노출한다(앵커링 저항, 계약/프롬프트). */
  strengthDiagnosis: StrengthDiagnosis;
  criticalDiagnosis: CriticalDiagnosis;
  /** 마감 유효 채용 공고 (verified_jobs). */
  verifiedJobs: JobRecommendation[];
  /** 마감 지난 채용 공고 (expired_jobs). 화면에서 약화 표기한다. */
  expiredJobs: JobRecommendation[];
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
}

// ─── Bookmark Extension ─────────────────────────────────────

export interface BookmarkedSnapshot extends AnalysisSnapshot {
  bookmarkedAt: string;
}

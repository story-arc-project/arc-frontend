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

export type WeaknessSeverity = "high" | "medium" | "low";
export type SynergyPriority = "high" | "medium" | "low";

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
  result: IndividualAnalysisResultBody;
}

// 진단/시너지 라벨
export const weaknessSeverityLabel: Record<WeaknessSeverity, string> = {
  high: "심각",
  medium: "보통",
  low: "경미",
};

export const synergyPriorityLabel: Record<SynergyPriority, string> = {
  high: "강력 추천",
  medium: "추천",
  low: "참고",
};

// ─── Comprehensive Analysis Detail ──────────────────────────
// 백엔드 응답 (prefix A_/B_… 제거된 형태):
// status, user_school, user_department, brief_summary, detailed_summary,
// keyword_clustering, experience_insights, synergy_combinations[],
// additional_recommendations, resume_star_format[], action_plan,
// critical_diagnosis, valid_job_recommendations[], missing_info_warning

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

export interface AdditionalRecommendations {
  certifications: string[];
  clubsAndSocieties: string[];
  projectsAndContests: string[];
}

export interface ContentQualityIssue {
  item: string;
  issue: string;
  improvementHint: string;
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
}

export interface ComprehensiveAnalysisResult {
  id: string;
  status: AnalysisStatus;
  isBookmarked: boolean;
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
  criticalDiagnosis: CriticalDiagnosis;
  validJobRecommendations: JobRecommendation[];
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
  matchedCriteria: number[]; // v4.1: compliance_criteria[].id 참조 배열
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

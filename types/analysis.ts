// ─── Enum Types ─────────────────────────────────────────────

import type { ImportanceLevel } from "./archive";

export type AnalysisType = "individual" | "comprehensive" | "keyword";
export type ConfidenceLevel = "sufficient" | "partial" | "insufficient";
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type KeywordCategory = "skill" | "work_style" | "value" | "job_domain";
export type { ImportanceLevel };

// ─── Common Structures ──────────────────────────────────────

export interface AnalysisSnapshot {
  id: string;
  type: AnalysisType;
  title: string;
  status: AnalysisStatus;
  createdAt: string;
  experienceCount: number;
  summaryText: string;
  overallConfidence: ConfidenceLevel;
  isBookmarked: boolean;
  selectedExperienceIds?: string[];
  selectedKeywords?: string[];
}

// ─── Korean Label Mappings ──────────────────────────────────

export const confidenceLevelLabel: Record<ConfidenceLevel, string> = {
  sufficient: "근거 충분",
  partial: "일부 근거",
  insufficient: "근거 부족",
};

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

export interface KeywordDefinition {
  keyword: string;
  definition: string;
  synonyms: string[];
  complianceCriteria: string[];
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
  relevance: string;
  evidence: KeywordEvidence[];
  matchedCriteria: string[];
  confidence: string;
  confidenceReason: string;
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

export interface KeywordStoryline {
  keyword: string;
  storylineTitle: string;
  structure: KeywordStorylineStructure;
  usedExperiences: { core: string[]; supporting: string[] };
  keyQuotes: string[];
}

export interface KeywordSpecificRecommendation {
  keyword: string;
  description: string;
}

export interface KeywordImprovementGuide {
  informationEnhancement: string[];
  experienceExpansion: string[];
  keywordSpecificRecommendations: KeywordSpecificRecommendation[];
}

export interface KeywordAnalysisResult {
  id: string;
  status: AnalysisStatus;
  analysisDate: string;
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
    improvementNeeded: number;
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

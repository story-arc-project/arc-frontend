// ─── Enum Types ─────────────────────────────────────────────

import type { ImportanceLevel } from "./archive";

export type AnalysisType = "individual" | "comprehensive" | "keyword";
export type ConfidenceLevel = "sufficient" | "partial" | "insufficient";
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type KeywordCategory = "skill" | "work_style" | "value" | "job_domain";
export type EvidenceRole = "primary" | "supporting";
export type ConnectionType =
  | "temporal_growth"
  | "cause_effect"
  | "role_expansion"
  | "impact_expansion"
  | "contrast_transition";
export type { ImportanceLevel };

// ─── Common Structures ──────────────────────────────────────

export interface Evidence {
  quote: string;
  sourceField?: string;
  experienceId?: string;
  experienceTitle?: string;
}

export interface Keyword {
  id: string;
  label: string;
  category: KeywordCategory;
  confidence: ConfidenceLevel;
  evidences: Evidence[];
}

export interface ImprovementGuide {
  reason: string;
  suggestion: string;
  targetField?: string;
}

export interface ActivityRecommendation {
  id: string;
  activity: string;
  reason: string;
  evidence: Evidence;
  expectedEffect: string;
  type: "expand" | "supplement";
  scenarioId?: string;
}

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

export const connectionTypeLabel: Record<ConnectionType, string> = {
  temporal_growth: "시간순 성장",
  cause_effect: "원인/결과",
  role_expansion: "역할 확장",
  impact_expansion: "임팩트 확장",
  contrast_transition: "대조/전환",
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

export interface ExperienceSummaryCard {
  experienceId: string;
  title: string;
  summary: string;
  highlight: string;
  role: EvidenceRole;
  importance: ImportanceLevel;
}

export interface Connection {
  fromExperienceId: string;
  fromTitle: string;
  toExperienceId: string;
  toTitle: string;
  connectionType: ConnectionType;
  strength: "strong" | "moderate" | "weak";
  evidence: Evidence;
  improvementGuide?: ImprovementGuide;
}

export interface Storyline {
  id: string;
  start: string;
  development: string;
  evidence: string;
  growth: string;
  arrival: string;
  coreExperienceIds: string[];
  supportingExperienceIds: string[];
}

export interface Scenario {
  id: string;
  title: string;
  rationale: string;
  recommendedExperienceIds: string[];
  emphasisPoints: string[];
  speakingOrder: string[];
  fitComment?: string;
}

export interface ComprehensiveAnalysisResult {
  id: string;
  title: string;
  analyzedAt: string;
  isBookmarked: boolean;
  overallConfidence: ConfidenceLevel;
  selectedExperienceIds: string[];
  // A
  experienceSummaries: ExperienceSummaryCard[];
  // B
  keywords: Keyword[];
  // C
  connections: Connection[];
  // D
  storylines: Storyline[];
  // E
  scenarios: Scenario[];
  // F
  commonRecommendations: ActivityRecommendation[];
  // G
  scenarioRecommendations: ActivityRecommendation[];
  // H
  confidenceGuide: {
    overallConfidence: ConfidenceLevel;
    improvementGuides: ImprovementGuide[];
  };
}

// ─── Keyword Analysis Detail ────────────────────────────────

export interface KeywordDefinition {
  keywordId: string;
  label: string;
  category: KeywordCategory;
  redefinition: string;
  synonyms: string[];
  fitCriteria: { id: string; description: string }[];
}

export interface KeywordCoverage {
  keywordId: string;
  label: string;
  matchedCount: number;
  totalCount: number;
}

export interface MatchedExperience {
  keywordId: string;
  experienceId: string;
  title: string;
  fitScore: number;
  evidence: Evidence;
  matchedCriteriaIds: string[];
}

export interface KeywordFitAxis {
  specificity: number;
  actionClarity: number;
  impactStrength: number;
  consistency: number;
}

export interface KeywordFitEvaluation {
  keywordId: string;
  label: string;
  totalScore: number;
  axes: KeywordFitAxis;
  strongEvidences: Evidence[];
  weakEvidences: Evidence[];
  missingEvidences: string[];
}

export interface KeywordSuggestion {
  id: string;
  label: string;
  category: KeywordCategory;
  reason: string;
  relatedExperienceCount: number;
}

export interface KeywordAnalysisResult {
  id: string;
  title: string;
  analyzedAt: string;
  isBookmarked: boolean;
  overallConfidence: ConfidenceLevel;
  selectedKeywords: string[];
  // A
  keywordDefinitions: KeywordDefinition[];
  // B
  selectionCriteria: string;
  // C
  coverage: KeywordCoverage[];
  // D
  matchedExperiences: MatchedExperience[];
  // E
  storylines: Storyline[];
  // F
  fitEvaluations: KeywordFitEvaluation[];
  // G
  improvementGuides: ImprovementGuide[];
  commonRecommendations: ActivityRecommendation[];
  keywordRecommendations: ActivityRecommendation[];
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

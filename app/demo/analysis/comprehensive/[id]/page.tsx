"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDateTime } from "@/lib/utils/date-utils";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import ExperienceSummariesSection from "@/components/features/analysis/sections/ExperienceSummariesSection";
import KeywordPatternSection from "@/components/features/analysis/sections/KeywordPatternSection";
import ConnectionStructureSection from "@/components/features/analysis/sections/ConnectionStructureSection";
import StorylineSection from "@/components/features/analysis/sections/StorylineSection";
import ScenarioSection from "@/components/features/analysis/sections/ScenarioSection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ConfidenceGuideSection from "@/components/features/analysis/sections/ConfidenceGuideSection";
import KeywordClusteringSection from "../../../_components/extra-sections/KeywordClusteringSection";
import CriticalDiagnosisSection from "../../../_components/extra-sections/CriticalDiagnosisSection";
import SynergyCombinationsSection from "../../../_components/extra-sections/SynergyCombinationsSection";
import ResumeStarSection from "../../../_components/extra-sections/ResumeStarSection";
import JobRecommendationsSection from "../../../_components/extra-sections/JobRecommendationsSection";
import ActionPlanSection from "../../../_components/extra-sections/ActionPlanSection";
import {
  demoComprehensiveResult,
  demoComprehensiveExtra,
} from "../../../_data/analysis-comprehensive";
import { DEMO_RESUME_VERSION_ID } from "../../../_data/resume";

export default function DemoComprehensiveDetailPage() {
  const data = demoComprehensiveResult;
  const extra = demoComprehensiveExtra;

  const scenarioRecGroups = data.scenarios.map((sc) => ({
    scenario: sc,
    recommendations: data.scenarioRecommendations.filter((r) => r.scenarioId === sc.id),
  }));

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/demo/analysis"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-text-primary">{data.title}</h1>
            <p className="text-body-sm text-text-tertiary mt-1">
              분석 시점: {formatDateTime(data.analyzedAt)} · 경험 {data.selectedExperienceIds.length}개
            </p>
            <p className="text-caption text-text-tertiary mt-1">
              {extra.userSchool} {extra.userDepartment}
            </p>
          </div>
          <BookmarkToggle analysisId={data.id} isBookmarked={data.isBookmarked} />
        </div>

        <div className="bg-surface-brand rounded-lg p-4 space-y-2">
          <p className="text-label text-brand-dark">핵심 요약</p>
          <p className="text-body text-text-primary leading-relaxed">{extra.briefSummary}</p>
          <p className="text-body-sm text-text-secondary leading-relaxed">{extra.detailedSummary}</p>
        </div>

        <hr className="border-border" />

        <ExperienceSummariesSection summaries={data.experienceSummaries} />
        <KeywordPatternSection keywords={data.keywords} />
        <KeywordClusteringSection
          personalityTendency={extra.keywordClustering.personalityTendency}
          coreCompetency={extra.keywordClustering.coreCompetency}
          jobIndustry={extra.keywordClustering.jobIndustry}
        />
        <ConnectionStructureSection connections={data.connections} />
        <StorylineSection storylines={data.storylines} />
        <ScenarioSection scenarios={data.scenarios} />
        <SynergyCombinationsSection combinations={extra.synergyCombinations} />

        <RecommendationSection
          title="연계 활동 추천 (공통)"
          recommendations={data.commonRecommendations}
        />

        {scenarioRecGroups.map(
          ({ scenario, recommendations }) =>
            recommendations.length > 0 && (
              <RecommendationSection
                key={scenario.id}
                title={`연계 활동 추천 — ${scenario.title}`}
                recommendations={recommendations}
              />
            ),
        )}

        <ResumeStarSection
          items={extra.resumeStarFormat}
          exportHref={`/demo/export/resume/${DEMO_RESUME_VERSION_ID}`}
        />
        <CriticalDiagnosisSection
          oneLineVerdict={extra.criticalDiagnosis.oneLineVerdict}
          weaknesses={extra.criticalDiagnosis.weaknesses}
          missingExperienceTypes={extra.criticalDiagnosis.missingExperienceTypes}
          competitorGap={extra.criticalDiagnosis.competitorGap}
        />
        <JobRecommendationsSection recommendations={extra.validJobRecommendations} />
        <ActionPlanSection plan={extra.actionPlan} />

        <ConfidenceGuideSection
          confidence={data.confidenceGuide.overallConfidence}
          guides={data.confidenceGuide.improvementGuides}
        />
      </div>
    </main>
  );
}

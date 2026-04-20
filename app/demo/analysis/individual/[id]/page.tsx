"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/utils/date-utils";
import { Badge } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import ExperienceSummarySection from "@/components/features/analysis/sections/ExperienceSummarySection";
import RoleInterpretationSection from "@/components/features/analysis/sections/RoleInterpretationSection";
import KeywordPatternSection from "@/components/features/analysis/sections/KeywordPatternSection";
import StarSummarySection from "@/components/features/analysis/sections/StarSummarySection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ConfidenceGuideSection from "@/components/features/analysis/sections/ConfidenceGuideSection";
import ReusableExpressionSection from "@/components/features/analysis/sections/ReusableExpressionSection";
import RelatedExperienceSection from "@/components/features/analysis/sections/RelatedExperienceSection";
import DeepAnalysisSection from "../../../_components/extra-sections/DeepAnalysisSection";
import ItemDiagnosisSection from "../../../_components/extra-sections/ItemDiagnosisSection";
import SynergyRecommendationsSection from "../../../_components/extra-sections/SynergyRecommendationsSection";
import ActionPlanSection from "../../../_components/extra-sections/ActionPlanSection";
import {
  demoIndividualResult,
  demoIndividualExtra,
} from "../../../_data/analysis-individual";

export default function DemoIndividualDetailPage() {
  const data = demoIndividualResult;
  const extra = demoIndividualExtra;

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
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-heading-2 text-text-primary">{data.experienceTitle}</h1>
              <Badge variant="brand">{data.experienceType}</Badge>
            </div>
            <p className="text-body-sm text-text-tertiary">
              분석 시점: {formatDateTime(data.analyzedAt)}
            </p>
            <Link
              href={`/demo/archive?id=${data.experienceId}`}
              className="inline-flex items-center gap-1 mt-2 text-caption text-brand font-medium hover:underline"
            >
              아카이브에서 보기 <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>
          <BookmarkToggle analysisId={data.id} isBookmarked={data.isBookmarked} />
        </div>

        <hr className="border-border" />

        <ExperienceSummarySection summary={data.summary} incidents={data.incidents} />
        <RoleInterpretationSection interpretations={data.roleInterpretations} />
        <KeywordPatternSection keywords={data.keywords} />
        <StarSummarySection summaries={data.starSummaries} guides={data.improvementGuides} />
        <RecommendationSection recommendations={data.recommendations} />
        <ConfidenceGuideSection confidence={data.overallConfidence} guides={data.improvementGuides} />
        <ReusableExpressionSection expressions={data.reusableExpressions} />
        <RelatedExperienceSection experiences={data.relatedExperiences} />

        {/* Schema extension sections */}
        <DeepAnalysisSection
          careerValue={extra.deepAnalysis.careerValue}
          strengths={extra.deepAnalysis.strengths}
          limitations={extra.deepAnalysis.limitations}
          applicableRoles={extra.deepAnalysis.applicableRoles}
          marketValue={extra.deepAnalysis.marketValue}
        />
        <ItemDiagnosisSection
          oneLineVerdict={extra.itemDiagnosis.oneLineVerdict}
          weaknesses={extra.itemDiagnosis.weaknesses}
          missingElements={extra.itemDiagnosis.missingElements}
          rewriteSuggestion={extra.itemDiagnosis.rewriteSuggestion}
        />
        <SynergyRecommendationsSection recommendations={extra.synergyRecommendations} />
        <ActionPlanSection plan={extra.actionPlan} />
      </div>
    </main>
  );
}

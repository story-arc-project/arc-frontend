"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { IndividualAnalysisResult } from "@/types/analysis";
import { getIndividualAnalysisResult } from "@/lib/analysis-api";
import { formatDateTime } from "@/lib/date-utils";
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

export default function IndividualAnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [data, setData] = useState<IndividualAnalysisResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getIndividualAnalysisResult(analysisId)
      .then(setData)
      .catch(() => setError(true));
  }, [analysisId]);

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href="/analysis/individual"
            className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
          <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-3/5 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-2/5 bg-surface-tertiary rounded animate-pulse" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-3">
              <div className="h-5 w-2/5 bg-surface-tertiary rounded" />
              <div className="h-3 w-full bg-surface-tertiary rounded" />
              <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back link */}
        <Link
          href="/analysis/individual"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-heading-2 text-text-primary">
                {data.experienceTitle}
              </h1>
              <Badge variant="brand">{data.experienceType}</Badge>
            </div>
            <p className="text-body-sm text-text-tertiary">
              분석 시점: {formatDateTime(data.analyzedAt)}
            </p>
            <Link
              href={`/archive?id=${data.experienceId}`}
              className="inline-flex items-center gap-1 mt-2 text-caption text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
            >
              아카이브에서 보기 <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>
          <BookmarkToggle
            analysisId={data.id}
            isBookmarked={data.isBookmarked}
          />
        </div>

        <hr className="border-border" />

        <ExperienceSummarySection
          summary={data.summary}
          incidents={data.incidents}
        />

        <RoleInterpretationSection
          interpretations={data.roleInterpretations}
        />

        <KeywordPatternSection keywords={data.keywords} />

        <StarSummarySection
          summaries={data.starSummaries}
          guides={data.improvementGuides}
        />

        <RecommendationSection recommendations={data.recommendations} />

        <ConfidenceGuideSection
          confidence={data.overallConfidence}
          guides={data.improvementGuides}
        />

        <ReusableExpressionSection expressions={data.reusableExpressions} />

        <RelatedExperienceSection experiences={data.relatedExperiences} />
      </div>
    </main>
  );
}

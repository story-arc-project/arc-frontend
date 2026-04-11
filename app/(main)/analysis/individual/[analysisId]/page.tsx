"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { IndividualAnalysisResult } from "@/types/analysis";
import { getIndividualAnalysisResult } from "@/lib/analysis-api";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IndividualAnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [data, setData] = useState<IndividualAnalysisResult | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    getIndividualAnalysisResult(analysisId).then((result) => {
      setData(result);
      setBookmarked(result.isBookmarked);
    });
  }, [analysisId]);

  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-surface-secondary rounded animate-pulse" />
          <div className="h-4 w-48 bg-surface-secondary rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back link */}
        <Link
          href="/analysis/individual"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
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
              분석 시점: {formatDate(data.analyzedAt)}
            </p>
            <Link
              href={`/archive?id=${data.experienceId}`}
              className="inline-flex items-center gap-1 mt-2 text-caption text-brand font-medium hover:underline"
            >
              아카이브에서 보기 <ExternalLink size={12} />
            </Link>
          </div>
          <BookmarkToggle
            isBookmarked={bookmarked}
            onToggle={() => setBookmarked(!bookmarked)}
          />
        </div>

        {/* Divider */}
        <hr className="border-border" />

        {/* A. Experience Summary + Incidents */}
        <ExperienceSummarySection
          summary={data.summary}
          incidents={data.incidents}
        />

        {/* B. Role/Action/Performance */}
        <RoleInterpretationSection
          interpretations={data.roleInterpretations}
        />

        {/* C. Keywords Top K */}
        <KeywordPatternSection keywords={data.keywords} />

        {/* D. STAR Summary */}
        <StarSummarySection
          summaries={data.starSummaries}
          guides={data.improvementGuides}
        />

        {/* E. Recommendations */}
        <RecommendationSection recommendations={data.recommendations} />

        {/* F. Confidence + Guides */}
        <ConfidenceGuideSection
          confidence={data.overallConfidence}
          guides={data.improvementGuides}
        />

        {/* G. Reusable Expressions */}
        <ReusableExpressionSection expressions={data.reusableExpressions} />

        {/* H. Related Experiences */}
        <RelatedExperienceSection experiences={data.relatedExperiences} />
      </div>
    </div>
  );
}

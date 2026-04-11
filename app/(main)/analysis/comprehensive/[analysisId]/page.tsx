"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComprehensiveAnalysisResult } from "@/types/analysis";
import { getComprehensiveResult } from "@/lib/analysis-api";
import { formatDateTime } from "@/lib/date-utils";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import ExperienceSummariesSection from "@/components/features/analysis/sections/ExperienceSummariesSection";
import KeywordPatternSection from "@/components/features/analysis/sections/KeywordPatternSection";
import ConnectionStructureSection from "@/components/features/analysis/sections/ConnectionStructureSection";
import StorylineSection from "@/components/features/analysis/sections/StorylineSection";
import ScenarioSection from "@/components/features/analysis/sections/ScenarioSection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ConfidenceGuideSection from "@/components/features/analysis/sections/ConfidenceGuideSection";

export default function ComprehensiveDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [data, setData] = useState<ComprehensiveAnalysisResult | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getComprehensiveResult(analysisId)
      .then((result) => {
        setData(result);
        setBookmarked(result.isBookmarked);
      })
      .catch(() => setError(true));
  }, [analysisId]);

  if (error) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href="/analysis/comprehensive"
            className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-64 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-48 bg-surface-tertiary rounded animate-pulse" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-3">
              <div className="h-5 w-40 bg-surface-tertiary rounded" />
              <div className="h-3 w-full bg-surface-tertiary rounded" />
              <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const scenarioRecGroups = data.scenarios.map((sc) => ({
    scenario: sc,
    recommendations: data.scenarioRecommendations.filter(
      (r) => r.scenarioId === sc.id
    ),
  }));

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/analysis/comprehensive"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-text-primary">{data.title}</h1>
            <p className="text-body-sm text-text-tertiary mt-1">
              분석 시점: {formatDateTime(data.analyzedAt)} · 경험{" "}
              {data.selectedExperienceIds.length}개
            </p>
          </div>
          <BookmarkToggle
            isBookmarked={bookmarked}
            onToggle={() => setBookmarked(!bookmarked)}
          />
        </div>

        <hr className="border-border" />

        <ExperienceSummariesSection summaries={data.experienceSummaries} />
        <KeywordPatternSection keywords={data.keywords} />
        <ConnectionStructureSection connections={data.connections} />
        <StorylineSection storylines={data.storylines} />
        <ScenarioSection scenarios={data.scenarios} />

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
            )
        )}

        <ConfidenceGuideSection
          confidence={data.confidenceGuide.overallConfidence}
          guides={data.confidenceGuide.improvementGuides}
        />
      </div>
    </div>
  );
}

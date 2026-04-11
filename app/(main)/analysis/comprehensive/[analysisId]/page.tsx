"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComprehensiveAnalysisResult } from "@/types/analysis";
import { getComprehensiveResult } from "@/lib/analysis-api";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import ExperienceSummariesSection from "@/components/features/analysis/sections/ExperienceSummariesSection";
import KeywordPatternSection from "@/components/features/analysis/sections/KeywordPatternSection";
import ConnectionStructureSection from "@/components/features/analysis/sections/ConnectionStructureSection";
import StorylineSection from "@/components/features/analysis/sections/StorylineSection";
import ScenarioSection from "@/components/features/analysis/sections/ScenarioSection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ConfidenceGuideSection from "@/components/features/analysis/sections/ConfidenceGuideSection";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComprehensiveDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [data, setData] = useState<ComprehensiveAnalysisResult | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    getComprehensiveResult(analysisId).then((result) => {
      setData(result);
      setBookmarked(result.isBookmarked);
    });
  }, [analysisId]);

  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-surface-secondary rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Group scenario recommendations by scenario ID
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
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-text-primary">{data.title}</h1>
            <p className="text-body-sm text-text-tertiary mt-1">
              분석 시점: {formatDate(data.analyzedAt)} · 경험{" "}
              {data.selectedExperienceIds.length}개
            </p>
          </div>
          <BookmarkToggle
            isBookmarked={bookmarked}
            onToggle={() => setBookmarked(!bookmarked)}
          />
        </div>

        <hr className="border-border" />

        {/* A. Experience Summaries */}
        <ExperienceSummariesSection summaries={data.experienceSummaries} />

        {/* B. Keywords/Patterns */}
        <KeywordPatternSection keywords={data.keywords} />

        {/* C. Connection Structure */}
        <ConnectionStructureSection connections={data.connections} />

        {/* D. Storyline */}
        <StorylineSection storylines={data.storylines} />

        {/* E. Scenarios */}
        <ScenarioSection scenarios={data.scenarios} />

        {/* F. Common Recommendations */}
        <RecommendationSection
          title="연계 활동 추천 (공통)"
          recommendations={data.commonRecommendations}
        />

        {/* G. Scenario Recommendations */}
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

        {/* H. Confidence Guide */}
        <ConfidenceGuideSection
          confidence={data.confidenceGuide.overallConfidence}
          guides={data.confidenceGuide.improvementGuides}
        />
      </div>
    </div>
  );
}

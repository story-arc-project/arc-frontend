"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { KeywordAnalysisResult } from "@/types/analysis";
import { getKeywordResult } from "@/lib/analysis-api";
import { Badge } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import KeywordDefinitionSection from "@/components/features/analysis/sections/KeywordDefinitionSection";
import CoverageSection from "@/components/features/analysis/sections/CoverageSection";
import MatchedExperienceSection from "@/components/features/analysis/sections/MatchedExperienceSection";
import StorylineSection from "@/components/features/analysis/sections/StorylineSection";
import KeywordFitSection from "@/components/features/analysis/sections/KeywordFitSection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ImprovementGuideCard from "@/components/features/analysis/common/ImprovementGuideCard";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KeywordDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [data, setData] = useState<KeywordAnalysisResult | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    getKeywordResult(analysisId).then((result) => {
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

  // Group keyword recommendations by keyword label
  const keywordRecGroups = data.keywordDefinitions.map((def) => ({
    label: def.label,
    recommendations: data.keywordRecommendations.filter((r) =>
      r.reason.includes(def.label)
    ),
  }));

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/analysis/keyword"
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
              분석 시점: {formatDate(data.analyzedAt)}
            </p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {data.selectedKeywords.map((kw) => (
                <Badge key={kw} variant="brand">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <BookmarkToggle
            isBookmarked={bookmarked}
            onToggle={() => setBookmarked(!bookmarked)}
          />
        </div>

        <hr className="border-border" />

        {/* A. Keyword Definition / Fit Criteria */}
        <KeywordDefinitionSection definitions={data.keywordDefinitions} />

        {/* B. Selection Criteria */}
        <section className="space-y-3">
          <h3 className="text-title text-text-primary">경험 선별 기준</h3>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {data.selectionCriteria}
            </p>
          </div>
        </section>

        {/* C. Coverage */}
        <CoverageSection coverage={data.coverage} />

        {/* D. Matched Experiences */}
        <MatchedExperienceSection
          matchedExperiences={data.matchedExperiences}
          definitions={data.keywordDefinitions}
        />

        {/* E. Storyline */}
        <StorylineSection
          title="키워드 기반 스토리라인"
          storylines={data.storylines}
        />

        {/* F. Keyword Fit Evaluation */}
        <KeywordFitSection evaluations={data.fitEvaluations} />

        {/* G. Improvement Guides + Recommendations */}
        <section className="space-y-6">
          <h3 className="text-title text-text-primary">
            보완 가이드 · 연계 활동 추천
          </h3>

          {/* Improvement guides */}
          {data.improvementGuides.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-text-tertiary">정보 보강</p>
              {data.improvementGuides.map((g, i) => (
                <ImprovementGuideCard key={i} guide={g} />
              ))}
            </div>
          )}

          {/* Common recommendations */}
          <RecommendationSection
            title="공통 추천"
            recommendations={data.commonRecommendations}
          />

          {/* Keyword-specific recommendations */}
          {keywordRecGroups.map(
            ({ label, recommendations }) =>
              recommendations.length > 0 && (
                <RecommendationSection
                  key={label}
                  title={`${label} 키워드 추천`}
                  recommendations={recommendations}
                />
              )
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDateTime } from "@/lib/utils/date-utils";
import { Badge } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import KeywordDefinitionSection from "@/components/features/analysis/sections/KeywordDefinitionSection";
import CoverageSection from "@/components/features/analysis/sections/CoverageSection";
import MatchedExperienceSection from "@/components/features/analysis/sections/MatchedExperienceSection";
import StorylineSection from "@/components/features/analysis/sections/StorylineSection";
import KeywordFitSection from "@/components/features/analysis/sections/KeywordFitSection";
import RecommendationSection from "@/components/features/analysis/sections/RecommendationSection";
import ImprovementGuideCard from "@/components/features/analysis/common/ImprovementGuideCard";
import { demoKeywordResult } from "../../../_data/analysis-keyword";

export default function DemoKeywordDetailPage() {
  const data = demoKeywordResult;

  const keywordRecGroups = useMemo(
    () =>
      data.keywordDefinitions.map((def) => ({
        label: def.label,
        recommendations: data.keywordRecommendations.filter((r) =>
          r.reason.includes(def.label),
        ),
      })),
    [data],
  );

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
              분석 시점: {formatDateTime(data.analyzedAt)}
            </p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {data.selectedKeywords.map((kw) => (
                <Badge key={kw} variant="brand">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <BookmarkToggle analysisId={data.id} isBookmarked={data.isBookmarked} />
        </div>

        <hr className="border-border" />

        <KeywordDefinitionSection definitions={data.keywordDefinitions} />

        <section className="space-y-3">
          <h2 className="text-title text-text-primary">경험 선별 기준</h2>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {data.selectionCriteria}
            </p>
          </div>
        </section>

        <CoverageSection coverage={data.coverage} />
        <MatchedExperienceSection
          matchedExperiences={data.matchedExperiences}
          definitions={data.keywordDefinitions}
        />
        <StorylineSection title="키워드 기반 스토리라인" storylines={data.storylines} />
        <KeywordFitSection evaluations={data.fitEvaluations} />

        <section className="space-y-6">
          <h2 className="text-title text-text-primary">보완 가이드 · 연계 활동 추천</h2>

          {data.improvementGuides.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-text-tertiary">정보 보강</p>
              {data.improvementGuides.map((g, i) => (
                <ImprovementGuideCard key={i} guide={g} />
              ))}
            </div>
          )}

          <RecommendationSection title="공통 추천" recommendations={data.commonRecommendations} />

          {keywordRecGroups.map(
            ({ label, recommendations }) =>
              recommendations.length > 0 && (
                <RecommendationSection
                  key={label}
                  title={`${label} 키워드 추천`}
                  recommendations={recommendations}
                />
              ),
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { BookmarkedSnapshot, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel, ANALYSIS_DETAIL_PATH, ANALYSIS_TYPE_FILTERS } from "@/types/analysis";
import { getBookmarks } from "@/lib/analysis-api";
import { formatDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import FilterBar from "@/components/features/analysis/common/FilterBar";

type FilterKey = "all" | AnalysisType;

export default function BookmarksPage() {
  const [items, setItems] = useState<BookmarkedSnapshot[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    getBookmarks({ type: filter })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-heading-2 text-text-primary">즐겨찾기</h1>
          <p className="text-body text-text-secondary mt-1">
            저장한 분석 결과를 모아볼 수 있어요.
          </p>
        </div>

        <FilterBar options={ANALYSIS_TYPE_FILTERS} value={filter} onChange={setFilter} id="bookmarks" />

        {error ? (
          <div className="py-12 text-center" role="alert">
            <p className="text-body text-text-secondary mb-3">
              데이터를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              다시 시도
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-12 bg-surface-tertiary rounded-full" />
                  <div className="h-5 w-2/5 bg-surface-tertiary rounded" />
                </div>
                <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
                <div className="h-3 w-1/3 bg-surface-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-body text-text-tertiary">
              아직 즐겨찾기한 분석이 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              분석 결과에서 &#9733;를 눌러 저장해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3" role="tabpanel" id={`bookmarks-panel-${filter}`} aria-labelledby={`bookmarks-tab-${filter}`}>
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`${ANALYSIS_DETAIL_PATH[item.type]}/${item.id}`}
                    className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">
                        {analysisTypeLabel[item.type]}
                      </Badge>
                      <span className="text-body-sm text-text-primary font-medium">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-body-sm text-text-secondary line-clamp-2">
                      {item.summaryText}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <ConfidenceBadge confidence={item.overallConfidence} />
                      <span className="text-caption text-text-tertiary">
                        저장: {formatDate(item.bookmarkedAt)}
                      </span>
                    </div>
                  </Link>
                  <BookmarkToggle
                    analysisId={item.id}
                    isBookmarked={true}
                    onToggled={() => {
                      setItems((prev) => prev.filter((p) => p.id !== item.id));
                    }}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

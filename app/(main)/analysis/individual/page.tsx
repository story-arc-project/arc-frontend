"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getIndividualAnalysisList } from "@/lib/analysis-api";
import { formatDate } from "@/lib/date-utils";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import AnalysisStatusBadge from "@/components/features/analysis/common/AnalysisStatusBadge";
import FilterBar from "@/components/features/analysis/common/FilterBar";

type FilterKey = "all" | "pending" | "completed";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기 중" },
  { key: "completed", label: "분석 완료" },
];

export default function IndividualAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getIndividualAnalysisList({ status: filter });
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-heading-2 text-text-primary">개별 경험 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            경험 하나하나의 역량과 강점을 분석합니다.
          </p>
        </div>

        <FilterBar options={FILTERS} value={filter} onChange={setFilter} id="individual" />

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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-2">
                <div className="h-4 w-2/5 bg-surface-tertiary rounded" />
                <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
                <div className="h-3 w-1/4 bg-surface-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              해당 조건의 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              경험을 기록하면 자동으로 분석이 시작됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3" role="tabpanel" id={`individual-panel-${filter}`} aria-labelledby={`individual-tab-${filter}`}>
            {items.map((item) => {
              const isPending = item.status === "pending";
              const displayStatus =
                item.status === "completed" ? "completed" : "pending";

              const content = (
                <div className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-body-sm text-text-primary font-medium">
                          {item.title}
                        </span>
                        <AnalysisStatusBadge status={displayStatus} />
                        {!isPending && (
                          <ConfidenceBadge confidence={item.overallConfidence} />
                        )}
                      </div>
                      {isPending ? (
                        <p className="text-body-sm text-text-tertiary">
                          입력 완료 후 자동 분석됩니다
                        </p>
                      ) : (
                        <p className="text-body-sm text-text-secondary line-clamp-1">
                          {item.summaryText}
                        </p>
                      )}
                      <p className="text-caption text-text-tertiary mt-1.5">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );

              if (isPending) {
                return (
                  <div key={item.id} className="opacity-60 cursor-not-allowed">
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={`/analysis/individual/${item.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-lg"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getIndividualAnalysisList } from "@/lib/analysis-api";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import AnalysisStatusBadge from "@/components/features/analysis/common/AnalysisStatusBadge";

type FilterKey = "all" | "pending" | "completed";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기 중" },
  { key: "completed", label: "분석 완료" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function IndividualAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getIndividualAnalysisList({ status: filter }).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [filter]);

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-heading-2 text-text-primary">개별 경험 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            경험 하나하나의 역량과 강점을 분석합니다.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                "px-3 py-1.5 rounded-md text-label transition-colors",
                filter === f.key
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-12 text-center">
            해당 조건의 분석 결과가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
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
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

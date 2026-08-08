"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getIndividualAnalysisList } from "@/lib/api/analysis-api";
import { formatDate } from "@/lib/utils/date-utils";
import { getDisplayTitle } from "@/lib/utils/analysis-display";
import { Button } from "@/components/ui";
import AnalysisStatusBadge from "@/components/features/analysis/common/AnalysisStatusBadge";
import FilterBar from "@/components/features/analysis/common/FilterBar";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

type FilterKey = "all" | "pending" | "completed";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기 중" },
  { key: "completed", label: "분석 완료" },
];

export default function IndividualAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // 화면이 지금 답해야 할 질문과, 실제로 답을 받아둔 질문. 둘이 다르면 그 자체가 로딩이다 —
  // 별도 플래그를 두지 않으므로 "로딩만 꺼지고 목록은 옛것"인 어긋난 중간 상태가 아예 없다.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${filter}:${retryKey}`;
  const loading = loadedKey !== requestKey;

  // 필터를 빠르게 바꾸면 이전 요청은 취소되지 않은 채 계속 날아온다. 늦게 도착한 답이
  // 무엇 하나라도 건드리면 탭과 내용이 어긋나므로, 응답 이후의 갱신은 전부 가드 안에 둔다.
  useEffect(() => {
    let ignore = false;
    getIndividualAnalysisList({ status: filter })
      .then((data) => {
        if (ignore) return;
        setItems(data);
        setError(false);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (ignore) return;
        setError(true);
        setLoadedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [filter, requestKey]);

  const handleRetry = () => setRetryKey((k) => k + 1);

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

        {/* 로딩이 에러보다 앞이다 — 재조회를 시작한 순간 화면은 이전 실패가 아니라
            지금 기다리는 중임을 보여야 한다. */}
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-2">
                <div className="h-4 w-2/5 bg-surface-tertiary rounded" />
                <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
                <div className="h-3 w-1/4 bg-surface-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center" role="alert">
            <p className="text-body text-text-secondary mb-3">
              데이터를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              다시 시도
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              해당 조건의 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              경험을 기록하면 자동으로 분석이 시작됩니다.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/archive">경험 기록하러 가기</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3" role="tabpanel" id={`individual-panel-${filter}`} aria-labelledby={`individual-tab-${filter}`}>
            {items.map((item) => {
              const isNavigable = item.status === "completed";
              const displayStatus =
                item.status === "failed"
                  ? "failed"
                  : isNavigable
                  ? "completed"
                  : "pending";

              return (
                <div
                  key={item.id}
                  className={[
                    "bg-surface border border-border rounded-lg p-4",
                    !isNavigable ? "opacity-60" : "hover:border-brand transition-colors",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    {isNavigable ? (
                      <Link
                        href={`/analysis/individual/${item.id}`}
                        className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-title text-text-primary">
                            {getDisplayTitle(item.title)}
                          </span>
                          <AnalysisStatusBadge status={displayStatus} />
                        </div>
                        <p className="text-caption text-text-tertiary mt-1.5">
                          {formatDate(item.createdAt)}
                        </p>
                      </Link>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-title text-text-primary">
                            {getDisplayTitle(item.title)}
                          </span>
                          <AnalysisStatusBadge status={displayStatus} />
                        </div>
                        <p className="text-body-sm text-text-tertiary">
                          {item.status === "processing"
                            ? "분석 진행 중..."
                            : item.status === "failed"
                            ? "분석에 실패했습니다"
                            : "입력 완료 후 자동 분석됩니다"}
                        </p>
                        <p className="text-caption text-text-tertiary mt-1.5">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    )}
                    <BookmarkToggle
                      analysisId={item.id}
                      isBookmarked={item.isBookmarked}
                      size="sm"
                      onToggled={(next) =>
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, isBookmarked: next } : i,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getComprehensiveList, deleteComprehensiveAnalysis } from "@/lib/analysis-api";
import { formatDate } from "@/lib/date-utils";
import { Button, Dialog } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

export default function ComprehensiveAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    getComprehensiveList()
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [deleteError, setDeleteError] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteError(false);
    try {
      await deleteComprehensiveAnalysis(deleteId);
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
      setDeleteId(null);
    } catch {
      setDeleteError(true);
    }
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-text-primary">종합 분석</h1>
            <p className="text-body text-text-secondary mt-1">
              여러 경험을 묶어 일관된 스토리라인을 만듭니다.
            </p>
          </div>
          <Link href="/analysis/comprehensive/new">
            <Button size="sm">
              <Plus size={16} aria-hidden="true" />
              새 종합 분석
            </Button>
          </Link>
        </div>

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
                <div className="h-4 w-2/5 bg-surface-tertiary rounded" />
                <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
                <div className="h-3 w-1/3 bg-surface-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              아직 종합 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              여러 경험을 선택해 종합 분석을 시작해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isProcessing = item.status === "processing";
              return (
                <div
                  key={item.id}
                  className={[
                    "bg-surface border border-border rounded-lg p-4",
                    isProcessing ? "opacity-60" : "hover:border-brand transition-colors",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isProcessing ? (
                        <div>
                          <span className="text-body-sm text-text-primary font-medium">
                            {item.title}
                          </span>
                          <p className="text-body-sm text-text-tertiary mt-1">
                            분석 진행 중...
                          </p>
                        </div>
                      ) : (
                        <Link href={`/analysis/comprehensive/${item.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-body-sm text-text-primary font-medium">
                              {item.title}
                            </span>
                            <ConfidenceBadge
                              confidence={item.overallConfidence}
                            />
                          </div>
                          <p className="text-body-sm text-text-secondary line-clamp-1">
                            {item.summaryText}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-caption text-text-tertiary">
                              경험 {item.experienceCount}개
                            </span>
                            <span className="text-caption text-text-tertiary">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <BookmarkToggle
                        analysisId={item.id}
                        isBookmarked={item.isBookmarked}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-tertiary hover:text-error hover:bg-surface-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        aria-label="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog
          open={deleteId !== null}
          onClose={() => { setDeleteId(null); setDeleteError(false); }}
          ariaLabel="분석 삭제 확인"
        >
          <h3 className="text-title text-text-primary mb-2">분석을 삭제할까요?</h3>
          <p className="text-body-sm text-text-secondary mb-4">
            삭제된 분석은 복구할 수 없습니다.
          </p>
          {deleteError && (
            <p className="text-body-sm text-error mb-3">삭제에 실패했습니다. 다시 시도해 주세요.</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setDeleteId(null); setDeleteError(false); }}
            >
              취소
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        </Dialog>
      </div>
    </main>
  );
}

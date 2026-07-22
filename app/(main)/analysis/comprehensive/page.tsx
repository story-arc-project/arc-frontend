"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getComprehensiveList, deleteComprehensiveAnalysis } from "@/lib/api/analysis-api";
import { isAnalysisRetryEnabled } from "@/lib/analysis/flags";
import { useRetryRefresh } from "@/lib/analysis/use-retry-refresh";
import { formatDate } from "@/lib/utils/date-utils";
import { getDisplayTitle } from "@/lib/utils/analysis-display";
import { Button, Dialog } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import RetryAnalysisButton from "@/components/features/analysis/common/RetryAnalysisButton";

export default function ComprehensiveAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) {
      setLoading(true);
      setError(false);
    }
    try {
      const data = await getComprehensiveList();
      setItems(data);
      setError(false);
    } catch {
      // 백그라운드 갱신 실패는 화면을 갈아치우지 않는다 — 이미 보고 있는 목록이 정답에 더 가깝다.
      if (!background) setError(true);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 폴링은 스켈레톤·전면 오류 없이 조용히 갱신한다.
  const refreshInBackground = useCallback(() => {
    void loadData({ background: true });
  }, [loadData]);

  // 재시도 접수 후 잠시 동안만 목록을 다시 읽는다 — 그러지 않으면 '진행 중'에 고착된다.
  const watchRetry = useRetryRefresh(refreshInBackground);

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
          <Button asChild size="sm" className="min-h-11 shrink-0 whitespace-nowrap sm:min-h-0">
            <Link href="/analysis/comprehensive/new" aria-label="새 종합 분석">
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">새 종합 분석</span>
            </Link>
          </Button>
        </div>

        {error ? (
          <div className="py-12 text-center" role="alert">
            <p className="text-body text-text-secondary mb-3">
              데이터를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={() => loadData()}
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
            <Button asChild size="sm" className="mt-4">
              <Link href="/analysis/comprehensive/new">
                <Plus size={16} aria-hidden="true" />
                새 종합 분석
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isNavigable = item.status === "completed";
              // 재시도 엔드포인트(BAC-42) 배포 전까지 플래그 off — 노출 없음
              const canRetry = item.status === "failed" && isAnalysisRetryEnabled();
              return (
                <div
                  key={item.id}
                  className={[
                    "bg-surface border border-border rounded-lg p-4",
                    isNavigable
                      ? "hover:border-brand transition-colors"
                      : // 다시 시도할 수 있는 카드는 흐리게 두지 않는다 — 유일한 액션 버튼까지
                        // 같이 흐려져 누를 수 있어 보이지 않는다.
                        canRetry
                        ? ""
                        : "opacity-60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {!isNavigable ? (
                        <div>
                          <span className="text-body-sm text-text-primary font-medium">
                            {getDisplayTitle(item.title)}
                          </span>
                          <p className="text-body-sm text-text-tertiary mt-1">
                            {item.status === "failed" ? "분석에 실패했습니다" : "분석 진행 중..."}
                          </p>
                          {canRetry && (
                            <RetryAnalysisButton
                              analysisId={item.id}
                              analysisType="comprehensive"
                              onRetried={() => {
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i.id === item.id ? { ...i, status: "processing" } : i,
                                  ),
                                );
                                watchRetry();
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <Link href={`/analysis/comprehensive/${item.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-body-sm text-text-primary font-medium">
                              {getDisplayTitle(item.title)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-caption text-text-tertiary">
                              경험 {item.experiences?.length ?? item.experienceCount}개
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
                        onToggled={(next) =>
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, isBookmarked: next } : i,
                            ),
                          )
                        }
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

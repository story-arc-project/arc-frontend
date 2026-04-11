"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getComprehensiveList, deleteComprehensiveAnalysis } from "@/lib/analysis-api";
import { Button, Dialog } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ComprehensiveAnalysisPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    getComprehensiveList().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  async function handleDelete() {
    if (!deleteId) return;
    await deleteComprehensiveAnalysis(deleteId);
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-text-primary">종합 분석</h1>
            <p className="text-body text-text-secondary mt-1">
              여러 경험을 묶어 일관된 스토리라인을 만듭니다.
            </p>
          </div>
          <Link href="/analysis/comprehensive/new">
            <Button size="sm">
              <Plus size={16} />
              새 종합 분석
            </Button>
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-12 text-center">
            아직 종합 분석 결과가 없습니다.
          </p>
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
                        <Link href={`/analysis/comprehensive/${item.id}`}>
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
                        isBookmarked={item.isBookmarked}
                        onToggle={() => {}}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="p-1 rounded-md text-text-tertiary hover:text-error hover:bg-surface-tertiary transition-colors"
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

        {/* Delete confirm dialog */}
        <Dialog
          open={deleteId !== null}
          onClose={() => setDeleteId(null)}
          ariaLabel="분석 삭제 확인"
        >
          <h3 className="text-title text-text-primary mb-2">분석을 삭제할까요?</h3>
          <p className="text-body-sm text-text-secondary mb-4">
            삭제된 분석은 복구할 수 없습니다.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteId(null)}
            >
              취소
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  );
}

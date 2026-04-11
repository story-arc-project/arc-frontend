"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Trash2, Pencil, Check, X, RotateCcw } from "lucide-react";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel, ANALYSIS_DETAIL_PATH, ANALYSIS_TYPE_FILTERS } from "@/types/analysis";
import {
  getAnalysisHistory,
  updateAnalysisMeta,
  deleteAnalysis,
} from "@/lib/analysis-api";
import { formatDate } from "@/lib/date-utils";
import { Badge, Button, Dialog } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import FilterBar from "@/components/features/analysis/common/FilterBar";

type FilterKey = "all" | AnalysisType;
type SortKey = "newest" | "oldest";

const NEW_PATH: Record<AnalysisType, string> = {
  individual: "/analysis/individual",
  comprehensive: "/analysis/comprehensive/new",
  keyword: "/analysis/keyword/new",
};

function InlineEdit({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(text);
          if (e.key === "Escape") onCancel();
        }}
        aria-label="분석 제목 변경"
        className="text-body-sm text-text-primary font-medium border-b border-brand bg-transparent outline-none px-0 py-0.5 max-w-full focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
      />
      <button
        type="button"
        onClick={() => onSave(text)}
        className="p-1 text-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        aria-label="저장"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-text-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        aria-label="취소"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    getAnalysisHistory({ type: filter, sort })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [filter, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRename(id: string, title: string) {
    try {
      await updateAnalysisMeta(id, { title });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, title } : i))
      );
      setEditId(null);
    } catch {
      // TODO: surface error to user via toast
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteAnalysis(deleteId);
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
      setDeleteId(null);
    } catch {
      setDeleteId(null);
    }
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-heading-2 text-text-primary">전체 분석 결과</h1>
          <p className="text-body text-text-secondary mt-1">
            지금까지의 모든 분석 결과를 모아볼 수 있어요.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <FilterBar options={ANALYSIS_TYPE_FILTERS} value={filter} onChange={setFilter} id="history" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="정렬 기준"
            className="px-3 py-2 min-h-[44px] w-full sm:w-auto text-label border border-border rounded-md bg-surface text-text-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-12 bg-surface-tertiary rounded-full" />
                  <div className="h-5 w-2/5 bg-surface-tertiary rounded" />
                  <div className="h-5 w-16 bg-surface-tertiary rounded-full" />
                </div>
                <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
                <div className="h-3 w-1/4 bg-surface-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              아직 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              경험을 기록하고 분석을 시작해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3" role="tabpanel" id={`history-panel-${filter}`} aria-labelledby={`history-tab-${filter}`}>
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">
                        {analysisTypeLabel[item.type]}
                      </Badge>
                      {editId === item.id ? (
                        <InlineEdit
                          value={item.title}
                          onSave={(v) => handleRename(item.id, v)}
                          onCancel={() => setEditId(null)}
                        />
                      ) : (
                        <Link
                          href={`${ANALYSIS_DETAIL_PATH[item.type]}/${item.id}`}
                          className="text-body-sm text-text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
                        >
                          {item.title}
                        </Link>
                      )}
                      <ConfidenceBadge confidence={item.overallConfidence} />
                    </div>
                    <p className="text-body-sm text-text-secondary line-clamp-1">
                      {item.summaryText}
                    </p>
                    <p className="text-caption text-text-tertiary mt-1.5">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <BookmarkToggle
                      analysisId={item.id}
                      isBookmarked={item.isBookmarked}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => setEditId(item.id)}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      aria-label="이름 변경"
                    >
                      <Pencil size={16} />
                    </button>
                    <Link
                      href={NEW_PATH[item.type]}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-tertiary hover:text-brand hover:bg-surface-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      aria-label="다시 분석"
                    >
                      <RotateCcw size={16} />
                    </Link>
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
            ))}
          </div>
        )}

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
    </main>
  );
}

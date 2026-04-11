"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Trash2, Pencil, Check, X, RotateCcw } from "lucide-react";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel } from "@/types/analysis";
import {
  getAnalysisHistory,
  updateAnalysisMeta,
  deleteAnalysis,
} from "@/lib/analysis-api";
import { Badge, Button, Dialog } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

type FilterKey = "all" | AnalysisType;
type SortKey = "newest" | "oldest";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "individual", label: "개별" },
  { key: "comprehensive", label: "종합" },
  { key: "keyword", label: "키워드" },
];

const DETAIL_PATH: Record<AnalysisType, string> = {
  individual: "/analysis/individual",
  comprehensive: "/analysis/comprehensive",
  keyword: "/analysis/keyword",
};

const NEW_PATH: Record<AnalysisType, string> = {
  individual: "/analysis/individual",
  comprehensive: "/analysis/comprehensive/new",
  keyword: "/analysis/keyword/new",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
        className="text-body-sm text-text-primary font-medium border-b border-brand bg-transparent outline-none px-0 py-0.5"
      />
      <button
        type="button"
        onClick={() => onSave(text)}
        className="p-0.5 text-success hover:text-success"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-0.5 text-text-tertiary hover:text-text-primary"
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
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAnalysisHistory({ type: filter, sort }).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [filter, sort]);

  async function handleRename(id: string, title: string) {
    await updateAnalysisMeta(id, { title });
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, title } : i))
    );
    setEditId(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteAnalysis(deleteId);
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-heading-2 text-text-primary">전체 분석 결과</h1>
          <p className="text-body text-text-secondary mt-1">
            지금까지의 모든 분석 결과를 모아볼 수 있어요.
          </p>
        </div>

        {/* Filter + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
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
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-1.5 text-label border border-border rounded-md bg-surface text-text-primary"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-12 text-center">
            분석 결과가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
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
                          href={`${DETAIL_PATH[item.type]}/${item.id}`}
                          className="text-body-sm text-text-primary font-medium hover:underline"
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
                      isBookmarked={item.isBookmarked}
                      onToggle={() => {}}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => setEditId(item.id)}
                      className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                      aria-label="이름 변경"
                    >
                      <Pencil size={14} />
                    </button>
                    <Link
                      href={NEW_PATH[item.type]}
                      className="p-1 rounded-md text-text-tertiary hover:text-brand hover:bg-surface-tertiary transition-colors"
                      aria-label="다시 분석"
                    >
                      <RotateCcw size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="p-1 rounded-md text-text-tertiary hover:text-error hover:bg-surface-tertiary transition-colors"
                      aria-label="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirm */}
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

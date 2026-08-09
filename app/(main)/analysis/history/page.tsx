"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Trash2, Pencil, Check, X, RotateCcw } from "lucide-react";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel, ANALYSIS_DETAIL_PATH, ANALYSIS_TYPE_FILTERS } from "@/types/analysis";
import {
  getAnalysisHistory,
  updateAnalysisMeta,
  deleteAnalysis,
} from "@/lib/api/analysis-api";
import { formatDate } from "@/lib/utils/date-utils";
import { getDisplayTitle } from "@/lib/utils/analysis-display";
import { useBasePath } from "@/lib/utils/use-base-path";
import { isImeComposing } from "@/lib/utils/keyboard";
import { Badge, Button, Dialog } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import FilterBar from "@/components/features/analysis/common/FilterBar";
import PartialFailureNotice from "@/components/features/analysis/common/PartialFailureNotice";

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
          // 조합 중 Enter 는 확정용, Escape 는 조합 취소용이므로 제목 편집을 끝내지 않는다.
          if (isImeComposing(e)) return;
          if (e.key === "Enter") onSave(text);
          if (e.key === "Escape") onCancel();
        }}
        aria-label="분석 제목 변경"
        className="text-title text-text-primary border-b border-brand bg-transparent outline-none px-0 py-0.5 max-w-full focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
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
  // 데모는 둘러보기만 한다 — 이름 변경·다시 분석·삭제는 mock 위에서 화면만 바꾸고
  // 재조회하면 되살아난다. 특히 '다시 분석'의 목적지(/new)는 데모에 미러링돼 있지도 않다(FRT-232).
  const basePath = useBasePath();
  const isDemo = basePath !== "";
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [failedTypes, setFailedTypes] = useState<AnalysisType[]>([]);
  const [error, setError] = useState(false);
  // 고른 필터·정렬과 세대를 한 값으로 묶는다. 따로 두면 "선택은 바뀌었는데 세대는 그대로"가
  // 가능해지고, 그러면 잠깐 다른 선택을 들렀다 돌아왔을 때 새 요청의 키가
  // 이미 받아둔 답의 키와 같아진다.
  const [request, setRequest] = useState<{
    filter: FilterKey;
    sort: SortKey;
    seq: number;
  }>({ filter: "all", sort: "newest", seq: 0 });
  const { filter, sort } = request;
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { id: string; type: AnalysisType } | null
  >(null);

  // 화면이 지금 답해야 할 질문과, 실제로 답을 받아둔 질문. 둘이 다르면 그 자체가 로딩이다 —
  // 별도 플래그를 두지 않으므로 "로딩만 꺼지고 목록은 옛것"인 어긋난 중간 상태가 아예 없다.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${filter}:${sort}:${request.seq}`;
  const loading = loadedKey !== requestKey;

  // 필터와 정렬 두 축으로 재조회한다 — 둘 다 빠르게 바꿀 수 있고, 그때마다 이전 요청은
  // 취소되지 않은 채 계속 날아온다. 늦게 도착한 답이 목록·에러·부분 실패 안내 중
  // 무엇 하나라도 건드리면 화면이 지금의 선택과 어긋나므로, 응답 이후의 갱신은 전부 가드 안에 둔다.
  useEffect(() => {
    let ignore = false;
    getAnalysisHistory({ type: filter, sort })
      .then((data) => {
        if (ignore) return;
        setItems(data.items);
        setFailedTypes(data.failedTypes);
        setError(false);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (ignore) return;
        // 전멸(세 소스 모두 실패)만 여기로 온다 — 화면 전체가 에러로 바뀌므로
        // 유형별 안내는 거둔다.
        setFailedTypes([]);
        setError(true);
        setLoadedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [filter, sort, requestKey]);

  // 이미 보고 있는 선택을 다시 고르는 건 아무 일도 아니다 — 같은 값을 돌려줘 재조회조차 만들지 않는다.
  const handleFilterChange = (next: FilterKey) =>
    setRequest((r) => (r.filter === next ? r : { ...r, filter: next, seq: r.seq + 1 }));

  const handleSortChange = (next: SortKey) =>
    setRequest((r) => (r.sort === next ? r : { ...r, sort: next, seq: r.seq + 1 }));

  const handleRetry = () => setRequest((r) => ({ ...r, seq: r.seq + 1 }));

  const [renameError, setRenameError] = useState<string | null>(null);

  async function handleRename(id: string, type: AnalysisType, title: string) {
    setRenameError(null);
    try {
      await updateAnalysisMeta(id, type, { title });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, title } : i))
      );
      setEditId(null);
    } catch {
      setRenameError("이름 변경에 실패했습니다.");
    }
  }

  const [deleteError, setDeleteError] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(false);
    try {
      await deleteAnalysis(deleteTarget.id, deleteTarget.type);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError(true);
    }
  }

  // 보고 있는 화면과 상관있는 실패만 알린다. 종합 탭을 보는 사용자에게 키워드 실패를
  // 알릴 이유가 없고(노이즈), 그 탭의 목록은 실제로 정확하다.
  const relevantFailures =
    filter === "all" ? failedTypes : failedTypes.filter((t) => t === filter);

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
          <FilterBar options={ANALYSIS_TYPE_FILTERS} value={filter} onChange={handleFilterChange} id="history" />
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortKey)}
            aria-label="정렬 기준"
            className="px-3 py-2 min-h-[44px] w-full sm:w-auto text-label border border-border rounded-md bg-surface text-text-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>

        {renameError && (
          <div role="alert" className="px-4 py-3 rounded-lg border border-border bg-surface text-body-sm text-error flex items-center justify-between">
            <p>{renameError}</p>
            <button onClick={() => setRenameError(null)} className="text-text-tertiary hover:text-text-primary transition-colors shrink-0">닫기</button>
          </div>
        )}

        {!error && !loading && relevantFailures.length > 0 && (
          <PartialFailureNotice
            message={`${relevantFailures.map((t) => analysisTypeLabel[t]).join("·")} 기록을 불러오지 못했어요. 목록에 보이지 않을 뿐, 사라진 것은 아니에요.`}
            onRetry={handleRetry}
          />
        )}

        {/* 로딩이 에러보다 앞이다 — 재조회를 시작한 순간 화면은 이전 실패가 아니라
            지금 기다리는 중임을 보여야 한다. */}
        {loading ? (
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
        ) : items.length === 0 && relevantFailures.length > 0 ? (
          // 목록이 빈 원인이 "없어서"가 아니라 "못 불러와서"인 경우다. 여기서 빈 상태
          // 문구를 그대로 두면 화면이 거짓말을 한다 — 위 안내와 '다시 시도'가 그 자리를 대신한다.
          null
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              아직 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              경험을 기록하고 분석을 시작해보세요.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href={`${basePath}/archive`}>경험 기록하러 가기</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3" role="tabpanel" id={`history-panel-${filter}`} aria-labelledby={`history-tab-${filter}`}>
            {items.map((item) => {
              const isNavigable = item.status === "completed";
              return (
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
                          onSave={(v) => handleRename(item.id, item.type, v)}
                          onCancel={() => setEditId(null)}
                        />
                      ) : isNavigable ? (
                        <Link
                          href={`${basePath}${ANALYSIS_DETAIL_PATH[item.type]}/${item.id}`}
                          className="text-title text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
                        >
                          {getDisplayTitle(item.title)}
                        </Link>
                      ) : (
                        <span className="text-title text-text-primary opacity-60 cursor-not-allowed">
                          {getDisplayTitle(item.title)}
                        </span>
                      )}
                    </div>
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
                    {/* 이름 변경·다시 분석·삭제는 데모에 없다 — 앞의 둘은 되돌아올 성공이고,
                        '다시 분석'의 목적지(/new)는 데모에 미러링돼 있지도 않다(FRT-232). */}
                    {!isDemo && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditId(item.id)}
                          disabled={item.type === "individual"}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-tertiary disabled:hover:bg-transparent"
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
                          onClick={() => setDeleteTarget({ id: item.id, type: item.type })}
                          disabled={item.type === "individual"}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-tertiary hover:text-error hover:bg-surface-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          aria-label="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        <Dialog
          open={deleteTarget !== null}
          onClose={() => { setDeleteTarget(null); setDeleteError(false); }}
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
              onClick={() => { setDeleteTarget(null); setDeleteError(false); }}
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BookmarkedSnapshot, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel, ANALYSIS_DETAIL_PATH, ANALYSIS_TYPE_FILTERS } from "@/types/analysis";
import { getBookmarks } from "@/lib/api/analysis-api";
import { formatDate } from "@/lib/utils/date-utils";
import { getDisplayTitle } from "@/lib/utils/analysis-display";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge, Button } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import FilterBar from "@/components/features/analysis/common/FilterBar";

type FilterKey = "all" | AnalysisType;

export default function BookmarksPage() {
  const basePath = useBasePath();
  const [items, setItems] = useState<BookmarkedSnapshot[]>([]);
  const [error, setError] = useState(false);
  // 고른 필터와 세대를 한 값으로 묶는다. 따로 두면 "필터는 바뀌었는데 세대는 그대로"가 가능해지고,
  // 그러면 잠깐 다른 탭을 들렀다 돌아왔을 때 새 요청의 키가 이미 받아둔 답의 키와 같아진다.
  const [request, setRequest] = useState<{ filter: FilterKey; seq: number }>({
    filter: "all",
    seq: 0,
  });
  const { filter } = request;
  // 화면이 지금 답해야 할 질문과, 실제로 답을 받아둔 질문. 둘이 다르면 그 자체가 로딩이다 —
  // 별도 플래그를 두지 않으므로 "로딩만 꺼지고 목록은 옛것"인 어긋난 중간 상태가 아예 없다.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${filter}:${request.seq}`;
  const loading = loadedKey !== requestKey;

  // 필터를 빠르게 바꾸면 이전 요청은 취소되지 않은 채 계속 날아온다. 늦게 도착한 답이
  // 무엇 하나라도 건드리면 탭과 내용이 어긋나므로, 응답 이후의 갱신은 전부 가드 안에 둔다.
  useEffect(() => {
    let ignore = false;
    getBookmarks({ type: filter })
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

  // 이미 보고 있는 필터를 다시 누르는 건 아무 일도 아니다 — 같은 값을 돌려줘 재조회조차 만들지 않는다.
  const handleFilterChange = (next: FilterKey) =>
    setRequest((r) => (r.filter === next ? r : { filter: next, seq: r.seq + 1 }));

  const handleRetry = () => setRequest((r) => ({ ...r, seq: r.seq + 1 }));

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-heading-2 text-text-primary">즐겨찾기</h1>
          <p className="text-body text-text-secondary mt-1">
            저장한 분석 결과를 모아볼 수 있어요.
          </p>
        </div>

        <FilterBar options={ANALYSIS_TYPE_FILTERS} value={filter} onChange={handleFilterChange} id="bookmarks" />

        {/* 로딩이 에러보다 앞이다 — 재조회를 시작한 순간 화면은 이전 실패가 아니라
            지금 기다리는 중임을 보여야 한다. */}
        {loading ? (
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
          <div className="py-16 text-center">
            <p className="text-body text-text-tertiary">
              아직 즐겨찾기한 분석이 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              분석 결과에서 &#9733;를 눌러 저장해보세요.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href={`${basePath}/analysis/history`}>분석 결과 보러 가기</Link>
            </Button>
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
                    href={`${basePath}${ANALYSIS_DETAIL_PATH[item.type]}/${item.id}`}
                    className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">
                        {analysisTypeLabel[item.type]}
                      </Badge>
                      <span className="text-title text-text-primary">
                        {getDisplayTitle(item.title)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
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

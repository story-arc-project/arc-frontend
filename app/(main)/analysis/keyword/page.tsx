"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getKeywordList, deleteKeywordAnalysis } from "@/lib/api/analysis-api";
import { isAnalysisRetryEnabled } from "@/lib/analysis/flags";
import {
  isAnalysisInFlight,
  useAnalysisProgressWatch,
} from "@/lib/analysis/use-analysis-progress-watch";
import { formatDate } from "@/lib/utils/date-utils";
import { getDisplayTitle } from "@/lib/utils/analysis-display";
import { Button, Badge, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import RetryAnalysisButton from "@/components/features/analysis/common/RetryAnalysisButton";

export default function KeywordAnalysisPage() {
  // 방금 만든 분석(FRT-176). 목록이 이 id 만은 "첫 조회에 이미 완료"여도 완료로 인정한다 —
  // 빨리 끝나는 분석(knn 경로)은 전이가 존재하지 않아 그러지 않으면 완료 신호를 놓친다.
  // 라우터 컨텍스트 밖(스토리북·단위 테스트)에서는 null 이다 — 그때는 그냥 감시만 한다.
  const router = useRouter();
  const startedId = useSearchParams()?.get("started") ?? null;

  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 사용자가 목록을 직접 바꾼 횟수(삭제·즐겨찾기·재시도 낙관적 갱신).
  // 폴링 GET 은 요청 시점의 서버 스냅샷을 들고 오므로, 그 사이 로컬 변경이 있었다면
  // 응답이 도착했을 땐 이미 낡았다 — 그대로 적용하면 방금 지운 카드가 되살아나고
  // '진행 중'으로 바꿔둔 카드가 '실패'로 되돌아가 중복 재시도를 유발한다.
  const mutationEpoch = useRef(0);
  const markLocalMutation = useCallback(() => {
    mutationEpoch.current += 1;
  }, []);

  // 반영했으면 true, 낡아서 버렸으면 false — 폴링이 관찰 기회를 헛되이 쓰지 않게 알려준다.
  const loadData = useCallback(async (options?: { background?: boolean }): Promise<boolean> => {
    const background = options?.background === true;
    if (!background) {
      setLoading(true);
      setError(false);
    }
    const epochAtRequest = mutationEpoch.current;
    try {
      const data = await getKeywordList();
      // 낡은 백그라운드 응답은 버린다. 전경 로드는 사용자가 기다리는 요청이라 그대로 적용한다.
      if (background && mutationEpoch.current !== epochAtRequest) return false;
      setItems(data);
      setError(false);
    } catch {
      // 백그라운드 갱신 실패는 화면을 갈아치우지 않는다 — 이미 보고 있는 목록이 정답에 더 가깝다.
      if (!background) setError(true);
    } finally {
      if (!background) setLoading(false);
    }
    return true;
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 폴링은 스켈레톤·전면 오류 없이 조용히 갱신한다.
  // Promise 를 그대로 돌려줘야 폴링이 완료를 기다린다(요청 겹침·응답 역전 방지).
  const refreshInBackground = useCallback(
    () => loadData({ background: true }),
    [loadData],
  );

  // 진행 중인 분석이 있는 동안만 목록을 다시 읽고, 완료를 관측해 화면 밖으로 알린다.
  // 재시도도 여기에 얹힌다 — 재시도 버튼이 카드를 낙관적으로 '진행 중'으로 바꾸므로
  // 별도 무장 없이 같은 감시에 걸린다.
  const { rearm } = useAnalysisProgressWatch({
    items,
    type: "keyword",
    startedId,
    refresh: refreshInBackground,
    onCompleted: (completed) => {
      toast(
        completed.length > 1
          ? `분석 ${completed.length}건이 완료됐어요.`
          : "분석이 완료됐어요.",
        "success",
      );
    },
  });

  // 그 분석이 **끝난 뒤에야** 쿼리를 지운다. 남겨두면 새로고침·재방문마다 같은 완료를 다시
  // 발화해 퍼널 지표(analysis_completed)가 부풀고 피드백 트리거가 반복된다 — 중복 방지는
  // 메모리 안의 기록이라 마운트를 넘기지 못하기 때문이다.
  //
  // 반대로 **진행 중일 때 지우면** 이 표시의 존재 이유가 무너진다: 걸어두고 목록을 떠났다가
  // 완료된 뒤 돌아오면 새 마운트엔 직전 상태도 표시도 없어 '이미 완료'로만 보이고,
  // 전이가 아니라는 이유로 완료 신호가 통째로 사라진다.
  const startedSettled =
    startedId !== null &&
    items.some((i) => i.id === startedId && !isAnalysisInFlight(i.status));
  useEffect(() => {
    if (!startedSettled) return;
    router.replace("/analysis/keyword", { scroll: false });
  }, [startedSettled, router]);

  const [deleteError, setDeleteError] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteError(false);
    try {
      await deleteKeywordAnalysis(deleteId);
      markLocalMutation();
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
      // 방금 지켜보던 분석을 지웠다면 표시부터 거둔다. 지워진 항목은 목록에 다시 나타나지
      // 않으므로 `startedSettled` 가 영영 참이 되지 못하고, 쿼리가 URL 에 눌러앉아 새로고침할
      // 때마다 돌아오지 않을 대상을 향한 감시가 처음부터 다시 시작된다.
      if (deleteId === startedId) {
        router.replace("/analysis/keyword", { scroll: false });
      }
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
            <h1 className="text-heading-2 text-text-primary">키워드 분석</h1>
            <p className="text-body text-text-secondary mt-1">
              특정 키워드에 부합하는 경험을 찾아 분석합니다.
            </p>
          </div>
          <Button asChild size="sm" className="min-h-11 shrink-0 whitespace-nowrap sm:min-h-0">
            <Link href="/analysis/keyword/new" aria-label="새 키워드 분석">
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">새 키워드 분석</span>
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
                <div className="flex gap-1.5 mt-1">
                  <div className="h-5 w-16 bg-surface-tertiary rounded-full" />
                  <div className="h-5 w-20 bg-surface-tertiary rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body text-text-tertiary">
              아직 키워드 분석 결과가 없습니다.
            </p>
            <p className="text-body-sm text-text-tertiary mt-1">
              키워드를 선택해 경험 분석을 시작해보세요.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/analysis/keyword/new">
                <Plus size={16} aria-hidden="true" />
                새 키워드 분석
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
                    {!isNavigable ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-body-sm text-text-primary font-medium">
                            {getDisplayTitle(item.title)}
                          </span>
                        </div>
                        <p className="text-body-sm text-text-tertiary mt-1">
                          {item.status === "failed" ? "분석에 실패했습니다" : "분석 진행 중..."}
                        </p>
                        {item.selectedKeywords && item.selectedKeywords.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {item.selectedKeywords.map((kw) => (
                              <Badge key={kw} variant="outline">{kw}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-caption text-text-tertiary mt-1.5">
                          {formatDate(item.createdAt)}
                        </p>
                        {canRetry && (
                          <RetryAnalysisButton
                            analysisId={item.id}
                            analysisType="keyword"
                            onRetried={() => {
                              markLocalMutation();
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id ? { ...i, status: "processing" } : i,
                                ),
                              );
                              // 재시도도 '방금 내가 건 분석'이다 — 표시를 되살려야 재시도 도중
                              // 목록을 떠났다가 완료 후 돌아왔을 때 그 완료를 관측할 수 있다.
                              rearm();
                              router.replace(
                                `/analysis/keyword?started=${encodeURIComponent(item.id)}`,
                                { scroll: false },
                              );
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/analysis/keyword/${item.id}`}
                        className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-body-sm text-text-primary font-medium">
                            {getDisplayTitle(item.title)}
                          </span>
                        </div>
                        {item.selectedKeywords && item.selectedKeywords.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {item.selectedKeywords.map((kw) => (
                              <Badge key={kw} variant="outline">{kw}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-caption text-text-tertiary mt-1.5">
                          {formatDate(item.createdAt)}
                        </p>
                      </Link>
                    )}
                    <div className="flex items-center gap-1">
                      <BookmarkToggle
                        analysisId={item.id}
                        isBookmarked={item.isBookmarked}
                        onToggled={(next) => {
                          markLocalMutation();
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, isBookmarked: next } : i,
                            ),
                          );
                        }}
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
            <Button variant="secondary" size="sm" onClick={() => { setDeleteId(null); setDeleteError(false); }}>
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

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnalysisSnapshot } from "@/types/analysis";
import { getComprehensiveList, deleteComprehensiveAnalysis, getKeywordList, deleteKeywordAnalysis } from "@/lib/api/analysis-api";
import { isAnalysisInFlight, useAnalysisProgressWatch } from "@/lib/analysis/use-analysis-progress-watch";
import { toast } from "@/components/ui/toast";

// Module-level domain configuration keeps the initial-load effect stable across renders.
const domains = {
  comprehensive: {
    load: () => getComprehensiveList(),
    remove: (id: string) => deleteComprehensiveAnalysis(id),
    path: "/analysis/comprehensive",
  },
  keyword: {
    load: () => getKeywordList(),
    remove: (id: string) => deleteKeywordAnalysis(id),
    path: "/analysis/keyword",
  },
};

/** Shared list lifecycle; domain-specific presentation and demo affordances stay in the pages. */
export function usePollingAnalysisList(type: keyof typeof domains) {
  const config = domains[type];
  const router = useRouter();
  const startedId = useSearchParams()?.get("started") ?? null;
  const [items, setItems] = useState<AnalysisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // "이 응답보다 **앞선 사실**이 이미 도착했다"를 세는 카운터.
  //
  // 폴링 GET 은 요청 시점의 서버 스냅샷을 들고 오므로, 그 사이에 더 새로운 사실이 화면에
  // 반영됐다면 응답이 도착했을 땐 이미 낡았다 — 그대로 적용하면 방금 지운 카드가 되살아나고
  // '진행 중'으로 바꿔둔 카드가 '실패'로 되돌아가 중복 재시도를 유발한다.
  //
  // 올리는 곳이 둘이다: ① 사용자가 목록을 직접 바꿨을 때(삭제·즐겨찾기·재시도 낙관적 갱신),
  // ② **전경 재조회를 시작했을 때**. ②를 빠뜨리면 초기 로드 실패 → 감시가 백그라운드 GET 을
  // 이미 쏜 상태 → 사용자가 '다시 시도' → 전경 응답이 먼저 도착 → 뒤늦은 백그라운드 응답이
  // 검사를 통과해 완료된 목록을 낡은 스냅샷으로 덮는다(되돌아간 '진행 중'이 완료 기록을 지워
  // 같은 완료가 다시 계측·알림된다). `paused` 는 새 폴링 **예약**만 막지 이미 날아간 요청은
  // 되돌리지 못하므로, 최신성 판정은 여기 한 곳에서 해야 한다.
  const mutationEpoch = useRef(0);
  const markLocalMutation = useCallback(() => {
    mutationEpoch.current += 1;
  }, []);

  // 반영했으면 true, 낡아서 버렸으면 false — 폴링이 관찰 기회를 헛되이 쓰지 않게 알려준다.
  const loadData = useCallback(async (options?: { background?: boolean }): Promise<boolean> => {
    const background = options?.background === true;
    if (!background) {
      // 사용자가 기다리는 조회가 시작됐다 — 그 전에 날아간 백그라운드 응답은 모두 낡았다.
      mutationEpoch.current += 1;
      setLoading(true);
      setError(false);
    }
    const epochAtRequest = mutationEpoch.current;
    try {
      const data = await config.load();
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
  }, [config]);

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
    type,
    startedId,
    refresh: refreshInBackground,
    // 사용자가 기다리는 조회가 떠 있는 동안은 폴링하지 않는다(응답 역전 방지).
    paused: loading,
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
    router.replace(config.path, { scroll: false });
  }, [startedSettled, router, config.path]);

  const [deleteError, setDeleteError] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteError(false);
    try {
      await config.remove(deleteId);
      markLocalMutation();
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
      // 방금 지켜보던 분석을 지웠다면 표시부터 거둔다. 지워진 항목은 목록에 다시 나타나지
      // 않으므로 `startedSettled` 가 영영 참이 되지 못하고, 쿼리가 URL 에 눌러앉아 새로고침할
      // 때마다 돌아오지 않을 대상을 향한 감시가 처음부터 다시 시작된다.
      if (deleteId === startedId) {
        router.replace(config.path, { scroll: false });
      }
      setDeleteId(null);
    } catch {
      setDeleteError(true);
    }
  }

  function handleRetried(id: string) {
    markLocalMutation();
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "processing" } : item));
    rearm();
    router.replace(`${config.path}?started=${encodeURIComponent(id)}`, { scroll: false });
  }

  function handleBookmarked(id: string, next: boolean) {
    markLocalMutation();
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, isBookmarked: next } : item));
  }

  function cancelDelete() {
    setDeleteId(null);
    setDeleteError(false);
  }

  return {
    items, loading, error, deleteId, deleteError, loadData,
    requestDelete: setDeleteId, cancelDelete, handleDelete, handleRetried, handleBookmarked,
  };
}

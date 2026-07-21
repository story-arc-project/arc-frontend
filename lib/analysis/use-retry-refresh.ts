"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 목록을 다시 읽는 간격. 분석은 큐에 들어가 수십 초 걸린다. */
const INTERVAL_MS = 5_000;
/** 상한 — 60초. 무한 폴링을 만들지 않는다(목록 화면은 원래 폴링하지 않는 설계). */
const MAX_TICKS = 12;

/**
 * FRT-108: 재시도를 접수한 뒤 목록을 유한 횟수 다시 읽는다.
 *
 * 재시도 직후 카드는 낙관적으로 '진행 중'이 되는데, 그대로 두면 새로고침 전까지 그 상태에
 * 고착된다 — 결과를 화면 안에서 볼 수 없고, 재실패해도 '다시 시도'가 되살아나지 않는다.
 * 사용자가 방금 누른 행동의 결과이므로 여기서만 서버를 다시 확인한다.
 *
 * 재시도하지 않은 사용자에게는 아무 요청도 나가지 않는다.
 */
export function useRetryRefresh(reload: () => void): () => void {
  const [round, setRound] = useState(0);
  const reloadRef = useRef(reload);

  // 렌더 중 ref 할당은 react-hooks/refs 위반이라 effect 에서 최신 값을 담는다.
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (round === 0) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      reloadRef.current();
      if (ticks >= MAX_TICKS) clearInterval(timer);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [round]);

  // 다시 누르면 상한이 처음부터 다시 세어진다.
  return useCallback(() => setRound((r) => r + 1), []);
}

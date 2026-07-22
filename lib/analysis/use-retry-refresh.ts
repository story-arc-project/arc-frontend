"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 이전 갱신이 끝난 뒤 다음 갱신까지의 간격. 분석은 큐에 들어가 수십 초 걸린다. */
const INTERVAL_MS = 5_000;
/** 상한 — 12회. 무한 폴링을 만들지 않는다(목록 화면은 원래 폴링하지 않는 설계).
 *  요청 완료 기준 간격이라 실제 관찰 창은 60초 이상일 수 있다. */
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
export function useRetryRefresh(reload: () => void | Promise<void>): () => void {
  const [round, setRound] = useState(0);
  const reloadRef = useRef(reload);

  // 렌더 중 ref 할당은 react-hooks/refs 위반이라 effect 에서 최신 값을 담는다.
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (round === 0) return;
    let cancelled = false;
    let ticks = 0;
    let timer: ReturnType<typeof setTimeout>;

    // setInterval 이 아니라 "끝난 뒤 다시 예약"이다 — 목록 GET 이 5초보다 오래 걸리면
    // 요청이 겹치고, 늦게 도착한 옛 응답이 새 응답을 덮어써 상태가 되돌아간다
    // (목록은 setItems 로 통째 교체된다). 백엔드가 느릴 때 요청이 쌓이지도 않는다.
    const schedule = () => {
      timer = setTimeout(async () => {
        ticks += 1;
        try {
          await reloadRef.current();
        } catch {
          // 갱신 실패는 폴링을 멈추지 않는다 — 다음 차례에 다시 읽는다.
        }
        if (cancelled || ticks >= MAX_TICKS) return;
        schedule();
      }, INTERVAL_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [round]);

  // 다시 누르면 상한이 처음부터 다시 세어진다.
  return useCallback(() => setRound((r) => r + 1), []);
}

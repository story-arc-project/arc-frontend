"use client";

// FRT-107: "화면을 떠났다"를 한 번만, 늦지 않게 관측하는 공용 타이머.
//
// 왜 직접 만드는가 — PostHog 의 표준 답은 $pageview/$pageleave 쌍의 $prev_pageview_duration
// 인데, 이 프로젝트는 autocapture·capture_pageview·capture_pageleave 를 전부 끄고
// $current_url 을 property_denylist 에 넣어 두었다(PostHogProvider). 파생할 재료가 없으므로
// 이탈·체류는 전부 수동으로 재야 한다.
//
// 세 가지가 어렵고, 여기서 한 번만 푼다:
//  1. 언제가 "떠남"인가 — SPA 이동(컴포넌트 언마운트)과 탭 종료(pagehide)는 서로 다른 신호다.
//     beforeunload/unload 는 bfcache 를 깨고 모바일에서 자주 뜨지 않아 쓰지 않는다.
//  2. 두 번 쏘면 안 된다 — pagehide 뒤에 언마운트가 이어서 온다.
//  3. StrictMode 는 개발에서 mount→unmount→mount 를 모사한다. 언마운트에서 곧바로 쏘면
//     0초짜리 유령 이탈이 남는다. 그래서 언마운트 발화는 한 틱 미루고, 같은 인스턴스가
//     곧바로 다시 마운트되면 그 예약을 취소하고 원래 시작 시각을 이어 쓴다.
//     (페이지가 통째로 사라지는 경우는 pagehide 가 이미 동기로 처리한 뒤다.)
import { useCallback, useEffect, useRef } from "react";

export interface ExitSignalOptions {
  // 잴 준비가 됐는가. false 인 동안은 시계가 돌지 않는다.
  // **끄는 것도 떠나는 것이다** — 흐름 밖으로 나갔는데 컴포넌트가 안 죽는 화면이 있다
  // (온보딩은 스텝 state 하나라 「← 이전」으로 흐름을 벗어나도 언마운트가 없다).
  // 다시 켜면 시계는 그때부터 새로 잰다.
  active: boolean;
  // 탭이 숨겨지는 순간도 "떠남"으로 칠 것인가.
  // 체류시간은 true(백그라운드로 넘어간 시간은 본 시간이 아니다),
  // 흐름 이탈은 false(탭 전환은 이탈이 아니다 — 돌아와서 계속 쓴다).
  onHidden: boolean;
  // 발화 직전의 마지막 거부권. 완료한 흐름을 이탈로 세지 않기 위한 것.
  shouldFire: () => boolean;
  onFire: (elapsedSeconds: number) => void;
  // 새 세션이 시작된 순간(시계를 0부터 다시 잡은 순간). 호출부가 세션에 매인 자기 상태를
  // 같은 시점에 비우기 위한 것 — "언제가 새 세션인가"의 판정을 여기 한 곳에만 둔다.
  onStart?: () => void;
}

export interface ExitSignalResult {
  // 흐름이 시작된 뒤 흐른 시간(초). 아직 시작 전이면 0.
  // 완료한 사람의 소요시간을 이탈한 사람의 elapsed_seconds 와 **같은 시계**로 재기 위한 것 —
  // 호출부가 자기 시계를 따로 두면 두 값이 조용히 어긋난다.
  elapsedSeconds: () => number;
}

export function useExitSignal({
  active,
  onHidden,
  shouldFire,
  onFire,
  onStart,
}: ExitSignalOptions): ExitSignalResult {
  // 발화는 언마운트 이후에도 일어난다 — 그때 옛 클로저가 굳지 않도록 커밋마다 최신값으로
  // 갈아둔다(렌더 중 ref 쓰기는 금지 — ExperienceFormV2 의 onProgressChangeRef 와 같은 패턴).
  const shouldFireRef = useRef(shouldFire);
  const onFireRef = useRef(onFire);
  const onStartRef = useRef(onStart);
  useEffect(() => {
    shouldFireRef.current = shouldFire;
    onFireRef.current = onFire;
    onStartRef.current = onStart;
  });

  const startedAtRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const deferredRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 직전 언마운트가 예약해 둔 발화가 있고 **지금도 흐름 안**이면 취소한다 — StrictMode 의
    // 모사 언마운트라 사용자가 떠난 게 아니다.
    //
    // ⚠️ active 가 꺼진 채로 다시 돌아온 경우는 취소하지 않는다. 예약을 무조건 지우면
    // "컴포넌트는 살아 있는데 흐름 밖으로 나갔다"(온보딩 「← 이전」)가 영영 관측되지 않는다.
    // 취소 조건에 active 를 빠뜨리면 이탈 관측이 조용히 사라지는 쪽으로 틀린다.
    const resumed = deferredRef.current !== null;
    if (resumed && active) {
      clearTimeout(deferredRef.current as ReturnType<typeof setTimeout>);
      deferredRef.current = null;
    }
    if (!active) return;
    if (!resumed) {
      firedRef.current = false;
      startedAtRef.current = Date.now();
      onStartRef.current?.();
    }

    const fire = (): void => {
      if (firedRef.current) return;
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      if (!shouldFireRef.current()) return;
      firedRef.current = true;
      onFireRef.current(Math.round((Date.now() - startedAt) / 1000));
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") fire();
    };

    if (onHidden) {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    window.addEventListener("pagehide", fire);

    return () => {
      if (onHidden) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      window.removeEventListener("pagehide", fire);
      // 한 틱 미루는 이유는 위 3번. 페이지 종료는 pagehide 가 이미 동기로 처리했으므로
      // 이 예약이 늦어서 유실될 걱정은 SPA 이동에 한정되고, 그때는 페이지가 살아 있다.
      deferredRef.current = setTimeout(() => {
        deferredRef.current = null;
        fire();
      }, 0);
    };
  }, [active, onHidden]);

  const elapsedSeconds = useCallback((): number => {
    const startedAt = startedAtRef.current;
    if (startedAt === null) return 0;
    return Math.round((Date.now() - startedAt) / 1000);
  }, []);

  return { elapsedSeconds };
}

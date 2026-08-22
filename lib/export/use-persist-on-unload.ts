"use client";

// FRT-329: 화면이 통째로 사라지는 순간(탭 닫기·새로고침·외부 이동)에도 편집을 남긴다.
//
// 임시 저장은 React 언마운트 cleanup 에서 일어나는데, 진짜 페이지 언로드에서는 그 cleanup 이
// 실행되지 않는다. 사용자에게는 GNB 로 나가는 것과 탭을 닫는 것이 구별되지 않으므로
// "나갔다 와도 남아 있더라"는 경험이 탭 닫기에서만 배신당한다. 그 구멍을 여기서 메운다.
//
// 신호는 두 개다(lib/analytics/exit-signal.ts 와 같은 선택):
//  - pagehide: 페이지가 실제로 내려가는 순간. 탭 닫기·새로고침·다른 사이트로 이동.
//  - visibilitychange(hidden): 탭 전환·모바일 백그라운드. 떠난 것은 아니지만 모바일은
//    이 뒤에 pagehide 없이 탭을 죽이는 일이 잦아, 여기서 먼저 담아 둔다.
// beforeunload 는 저장 경로로 쓰지 않는다 — 경고 문구용으로만 남긴다(Firefox 에서는 bfcache 를
// 깨지만 Chrome·Safari 는 넣는다).
//
// 그래서 pagehide 가 끝이 아닐 수 있다 — bfcache 에서 같은 인스턴스가 되살아나면(pageshow,
// persisted) 호출부의 "한 이탈은 한 번만" 가드가 남아 다음 이탈이 안 세진다. 되살아남을
// onRestore 로 알린다.
//
// 레쥬메·자소서 상세가 같은 훅을 쓴다. 두 화면은 구조가 같아 결함도 대칭이었고(이슈),
// 한쪽만 고치면 두 기능의 동작이 갈린다 — 같은 훅이 그 비대칭을 막는다.
import { useEffect, useRef } from "react";

export type PersistReason = "hidden" | "pagehide";

export interface PersistOnUnloadOptions {
  // 남길 편집이 있는가(dirty). false 면 리스너를 걸지 않는다.
  enabled: boolean;
  // 동기로 끝나야 한다 — 언로드 중에는 비동기 작업이 살아남지 않는다.
  onPersist: (reason: PersistReason) => void;
  // bfcache 에서 되살아났다(pageshow.persisted). pagehide 가 남긴 이탈 가드를 되돌릴 자리.
  onRestore?: () => void;
}

export function usePersistOnUnload({
  enabled,
  onPersist,
  onRestore,
}: PersistOnUnloadOptions): void {
  // 리스너는 enabled 가 바뀔 때만 다시 건다. 그 사이 편집이 더 진행돼 새 클로저가 생겨도
  // 최신 것을 부르도록 커밋마다 갈아둔다(렌더 중 ref 쓰기는 금지 — exit-signal 과 같은 패턴).
  const onPersistRef = useRef(onPersist);
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onPersistRef.current = onPersist;
    onRestoreRef.current = onRestore;
  });

  useEffect(() => {
    if (!enabled) return;

    const handlePageHide = (): void => {
      onPersistRef.current("pagehide");
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") onPersistRef.current("hidden");
    };
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) onRestoreRef.current?.();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);
}

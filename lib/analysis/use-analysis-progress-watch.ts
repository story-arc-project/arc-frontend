"use client";

import { useEffect, useRef } from "react";

import { capture } from "@/lib/analytics";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import type { AnalysisSnapshot, AnalysisStatus } from "@/types/analysis";

/** 이전 갱신이 끝난 뒤 다음 갱신까지의 간격. 분석은 큐에 들어가 수십 초 걸린다. */
const INTERVAL_MS = 5_000;
/** 상한 — 실제로 반영된 갱신 60회(≈5분). 요청 완료 기준 간격이라 실제 관찰 창은 더 길다.
 *  무한 폴링을 만들지 않되, **소진을 실패로 단정하지 않는다**(FRT-176). */
const MAX_TICKS = 60;
/** 절대 상한 — 버려진 응답까지 포함한 요청 횟수. 낡은 응답이 계속 버려지더라도
 *  폴링이 끝나도록 보장하는 안전판이다. */
const MAX_DISPATCHES = 90;
/** 이 화면에 머무는 동안의 **생애 상한**. 위 두 상한은 감시 대상이 바뀔 때마다 다시 세어지므로
 *  (재시도를 되살리려면 그래야 한다), 그것만으로는 "완료·추가가 번갈아 일어나면 예산이 계속
 *  갱신된다"는 구멍이 남는다. 이 값은 리셋되지 않아 무한 폴링을 최종적으로 막는다. */
const MAX_LIFETIME_DISPATCHES = 240;

type WatchableType = "comprehensive" | "keyword";

function isInFlight(status: AnalysisStatus): boolean {
  return status === "pending" || status === "processing";
}

interface Options {
  /** 현재 목록. 이 배열의 status 변화가 유일한 관측원이다. */
  items: AnalysisSnapshot[];
  type: WatchableType;
  /**
   * 방금 만든 분석 id(`?started=`). 이 항목만은 **첫 관측이 이미 `completed` 여도** 완료로 친다.
   * 빠르게 끝나는 분석(키워드 knn 등)은 목록 첫 GET 시점에 이미 완료라 전이가 존재하지 않는데,
   * 전이만 보면 그 완료를 영영 놓친다 — 대기 화면이 있던 시절엔 잘 잡히던 경로다.
   */
  startedId?: string | null;
  /** 목록을 조용히 다시 읽는다. `false` 를 돌려주면 "낡아서 버린 응답"으로 보고 예산에서 깎지 않는다. */
  refresh: () => boolean | void | Promise<boolean | void>;
  /** 이번 갱신에서 완료로 관측된 항목들. 화면 알림(토스트)은 호출부가 정한다. */
  onCompleted?: (completed: AnalysisSnapshot[]) => void;
}

/**
 * FRT-176: 목록 화면이 진행 중인 분석을 지켜보고, 완료를 **관측**해 밖으로 알린다.
 *
 * 예전에는 분석 생성 화면이 60초 예산으로 폴링하다가 예산이 끝나면 "시간 초과" 오류를 띄웠다.
 * 분석은 실패한 적이 없었고 화면만 거짓말을 했다 — 예산을 키우는 대신 대기 화면을 없앴다.
 * 그래서 완료 시점을 관측하던 주체가 사라졌고, 그 자리를 이 훅이 대신한다.
 *
 * 완료 관측이 중요한 이유는 두 신호가 **오직 그 순간에만** 나갈 수 있기 때문이다:
 * `analysis_completed` 계측(FRT-19 퍼널 백본)과 피드백 모달 트리거(FRT-95).
 *
 * ⚠️ 관측 창은 "사용자가 이 목록에 머무는 동안"이다. 걸어두고 목록을 떠나면 완료돼도 신호가
 * 나가지 않는다. 그럼에도 예전(60초 안에 대기 화면에 머문 경우만)보다는 넓다.
 */
export function useAnalysisProgressWatch({
  items,
  type,
  startedId = null,
  refresh,
  onCompleted,
}: Options): void {
  const triggers = useFeedbackTriggers();

  const refreshRef = useRef(refresh);
  const onCompletedRef = useRef(onCompleted);
  const triggersRef = useRef(triggers);

  // 렌더 중 ref 할당은 react-hooks/refs 위반이라 effect 에서 최신 값을 담는다.
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);
  useEffect(() => {
    triggersRef.current = triggers;
  }, [triggers]);

  /** 직전 관측의 id→status. `null` 이면 아직 한 번도 관측하지 않았다(최초 렌더). */
  const prevStatusRef = useRef<Map<string, AnalysisStatus> | null>(null);
  /** 완료를 이미 알린 id. 다시 진행 중으로 관측되면 지워 재발화를 허용한다. */
  const firedRef = useRef<Set<string>>(new Set());
  /** 이 마운트에서 나간 갱신 요청 총계. 감시 대상이 바뀌어도 리셋하지 않는다. */
  const lifetimeDispatchesRef = useRef(0);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const fired = firedRef.current;
    const completed: AnalysisSnapshot[] = [];

    for (const item of items) {
      if (isInFlight(item.status)) {
        // 재시도 등으로 다시 진행 중이 됐다 — 다음 완료는 새 완료다.
        // 판정을 호출부의 onRetried 타이밍에 결합시키지 않으려고 여기서 결정론적으로 지운다.
        fired.delete(item.id);
        continue;
      }
      if (item.status !== "completed" || fired.has(item.id)) continue;

      const previous = prev?.get(item.id);
      // 직전에 진행 중/실패로 보고 있던 것이 완료됐다 = 이 화면에서 관측한 완료.
      const transitioned = previous !== undefined && previous !== "completed";
      // 방금 내가 건 분석은 첫 관측이 이미 완료여도 관측한 완료로 친다.
      const isJustStarted = item.id === startedId;

      if (!transitioned && !isJustStarted) continue;

      fired.add(item.id);
      completed.push(item);
    }

    // 목록에서 사라진 항목(삭제)의 기록은 정리한다 — 서버가 그 id 를 다시 주지 않으므로
    // 오발화 위험은 없고, 남겨두면 ref 가 계속 자란다.
    const presentIds = new Set(items.map((i) => i.id));
    for (const id of fired) {
      if (!presentIds.has(id)) fired.delete(id);
    }

    prevStatusRef.current = new Map(items.map((i) => [i.id, i.status]));

    if (completed.length === 0) return;

    for (const item of completed) {
      // FRT-19 퍼널의 완료 등뼈. 코드베이스에서 이 이벤트를 내는 유일한 지점이다.
      capture("analysis_completed", { analysis_type: type });
      triggersRef.current?.reportAnalysisCompleted({
        analysisId: item.id,
        analysisType: type,
      });
    }
    // 화면 알림은 건별이 아니라 한 번에 준다 — 여러 건이 같이 끝나면 토스트가 겹친다.
    onCompletedRef.current?.(completed);
  }, [items, type, startedId]);

  // 감시 대상 = 지금 진행 중인 id 들. **불리언이 아니라 집합**으로 잡는다 — 불리언이면
  // 예산이 소진된 뒤에 다른 카드를 재시도해도 값이 계속 true 라 폴링이 되살아나지 않고,
  // 그 카드는 서버가 다 만든 뒤에도 '진행 중'에 고착된다(전체 새로고침만 탈출구다).
  // 예산은 "이 집합이 마지막으로 바뀐 시점"부터 센다. 집합이 바뀌었다는 건 서버가 실제로
  // 진행했거나 사용자가 방금 무언가를 걸었다는 뜻이라, 그때 다시 세는 게 맞다.
  const inFlightKey = items
    .filter((item) => isInFlight(item.status))
    .map((item) => item.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!inFlightKey) return;
    // 생애 예산을 이미 다 썼으면 감시 대상이 바뀌어도 다시 시작하지 않는다.
    if (lifetimeDispatchesRef.current >= MAX_LIFETIME_DISPATCHES) return;
    let cancelled = false;
    let ticks = 0;
    let dispatches = 0;
    let timer: ReturnType<typeof setTimeout>;

    // setInterval 이 아니라 "끝난 뒤 다시 예약"이다 — 목록 GET 이 5초보다 오래 걸리면
    // 요청이 겹치고, 늦게 도착한 옛 응답이 새 응답을 덮어써 상태가 되돌아간다
    // (목록은 setItems 로 통째 교체된다). 백엔드가 느릴 때 요청이 쌓이지도 않는다.
    const schedule = () => {
      timer = setTimeout(async () => {
        dispatches += 1;
        lifetimeDispatchesRef.current += 1;
        // 호출부가 false 를 주면 "그 사이 목록이 바뀌어 응답을 버렸다"는 뜻이다.
        // 서버를 들여다볼 기회를 쓴 게 아니므로 상한에서 깎지 않는다 — 깎으면 폴링 중에
        // 삭제·즐겨찾기를 누르기만 해도 '진행 중' 카드가 결과를 못 본 채 예산을 잃는다.
        let applied = true;
        try {
          applied = (await refreshRef.current()) !== false;
        } catch {
          // 갱신 실패는 폴링을 멈추지 않는다 — 다음 차례에 다시 읽는다.
          // (실패는 기회를 쓴 것으로 센다 — 서버가 계속 죽어 있으면 상한에서 멈춰야 한다.)
        }
        if (applied) ticks += 1;
        if (
          cancelled ||
          ticks >= MAX_TICKS ||
          dispatches >= MAX_DISPATCHES ||
          lifetimeDispatchesRef.current >= MAX_LIFETIME_DISPATCHES
        ) {
          return;
        }
        schedule();
      }, INTERVAL_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inFlightKey]);
}

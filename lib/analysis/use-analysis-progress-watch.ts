"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function isAnalysisInFlight(status: AnalysisStatus): boolean {
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
  /**
   * 전경 로드(사용자가 기다리는 목록 조회)가 떠 있는 동안 `true`. 그동안은 폴링하지 않는다.
   *
   * 전경 응답은 **무조건 적용**된다(사용자가 기다린 요청이라 버릴 수 없다). 그래서 느린 첫
   * 조회가 5초를 넘기면 그 위로 백그라운드 갱신이 겹치고, 늦게 도착한 옛 전경 응답이 새
   * 스냅샷을 덮어써 완료 카드가 '진행 중'으로 되돌아간다 — 그러면 발화 기록까지 지워져
   * 같은 완료가 다시 계측·알림된다.
   */
  paused?: boolean;
  /**
   * 이 화면에서 **변화로 관측된** 완료들. 알림 문구는 호출부가 정한다.
   *
   * 도착했을 때 이미 끝나 있던 건(`startedId` 규칙으로 신호는 나가는 경우) 여기 담지 않는다 —
   * 알릴 '변화'가 없기 때문이다. 담으면 방금 "분석을 시작했어요"를 본 사용자에게 곧바로
   * "완료됐어요"가 겹쳐 뜬다. 계측·피드백 트리거는 "완료 사실"이 필요하지만 알림은 "변화"가
   * 필요하다 — 조건이 다르므로 갈라 둔다.
   */
  onCompleted?: (transitioned: AnalysisSnapshot[]) => void;
}

interface Result {
  /**
   * 사람이 방금 무언가를 걸었으니 예산을 처음부터 다시 세라. 자동 상한은 **지켜보는 사람이
   * 없을 때** 무한 폴링을 막으려는 것이지, 버튼을 누른 사용자를 가두려는 게 아니다.
   * (재시도 접수 직후 호출한다 — 그러지 않으면 상한에 닿은 화면에서 누른 재시도가
   * 아무 반응도 없이 '진행 중'에 머문다.)
   */
  rearm: () => void;
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
  paused = false,
}: Options): Result {
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
  /** 이 마운트에서 나간 갱신 요청 총계. 감시 대상이 바뀌어도 리셋하지 않는다(사람이 rearm 하면 리셋). */
  const lifetimeDispatchesRef = useRef(0);
  const [rearmEpoch, setRearmEpoch] = useState(0);

  const rearm = useCallback(() => {
    lifetimeDispatchesRef.current = 0;
    setRearmEpoch((epoch) => epoch + 1);
  }, []);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const fired = firedRef.current;
    const completed: AnalysisSnapshot[] = [];
    /** 그중 이 화면에서 '진행 중 → 완료'로 **바뀌는 걸 본** 것들. 알림은 이것만 대상이다. */
    const transitioned: AnalysisSnapshot[] = [];

    for (const item of items) {
      if (isAnalysisInFlight(item.status)) {
        // 재시도 등으로 다시 진행 중이 됐다 — 다음 완료는 새 완료다.
        // 판정을 호출부의 onRetried 타이밍에 결합시키지 않으려고 여기서 결정론적으로 지운다.
        fired.delete(item.id);
        continue;
      }
      if (item.status !== "completed" || fired.has(item.id)) continue;

      const previous = prev?.get(item.id);
      // 직전에 진행 중/실패로 보고 있던 것이 완료됐다 = 이 화면에서 관측한 완료.
      const changed = previous !== undefined && previous !== "completed";
      // 방금 내가 건 분석은 첫 관측이 이미 완료여도 관측한 완료로 친다.
      const isJustStarted = item.id === startedId;

      if (!changed && !isJustStarted) continue;

      fired.add(item.id);
      completed.push(item);
      if (changed) transitioned.push(item);
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
      //
      // 계측은 best-effort 다 — posthog 가 던지면(브라우저 저장소 차단 등) effect 가 거기서
      // 끊겨 피드백 트리거도 토스트도 못 나가고, 이 id 는 이미 발화 기록에 들어가 다시 시도되지
      // 않는다. 계측 실패가 사용자 흐름을 끊어서는 안 된다(RetryAnalysisButton 과 같은 규칙).
      try {
        capture("analysis_completed", {
          analysis_type: type,
          analysis_id: item.id,
        });
      } catch {
        // 삼킨다. 관측이 없어도 완료는 완료다.
      }
      triggersRef.current?.reportAnalysisCompleted({
        analysisId: item.id,
        analysisType: type,
      });
    }
    // 화면 알림은 건별이 아니라 한 번에 준다 — 여러 건이 같이 끝나면 토스트가 겹친다.
    if (transitioned.length > 0) onCompletedRef.current?.(transitioned);
  }, [items, type, startedId]);

  // 감시 대상 = 지금 진행 중인 id 들. **불리언이 아니라 집합**으로 잡는다 — 불리언이면
  // 예산이 소진된 뒤에 다른 카드를 재시도해도 값이 계속 true 라 폴링이 되살아나지 않고,
  // 그 카드는 서버가 다 만든 뒤에도 '진행 중'에 고착된다(전체 새로고침만 탈출구다).
  // 예산은 "이 집합이 마지막으로 바뀐 시점"부터 센다. 집합이 바뀌었다는 건 서버가 실제로
  // 진행했거나 사용자가 방금 무언가를 걸었다는 뜻이라, 그때 다시 세는 게 맞다.
  const inFlightIds = items
    .filter((item) => isAnalysisInFlight(item.status))
    .map((item) => item.id);

  // 방금 만든 분석이 **아직 목록에 안 뜬** 경우도 지켜본다. 생성 응답과 첫 목록 조회 사이에
  // 그 행이 보이지 않을 수 있는데(복제 지연 등), 진행 중 항목이 하나도 없다는 이유로 감시를
  // 걸지 않으면 사용자는 "내 분석이 어디 갔지" 상태로 남고 새로고침 전까지 아무 일도 없다.
  //
  // ⚠️ 영영 나타나지 않는 id(다른 탭에서 지웠거나 URL 을 손으로 고친 경우)는 여기서 걸러내지
  // 못한다 — "아직 안 옴"과 "다시는 안 옴"이 이 자리에서는 구분되지 않는다. 이 화면에서 지운
  // 경우는 호출부가 표시를 즉시 거두므로 닫히고, 나머지는 생애 상한이 받아낸다(그 상한의 존재
  // 이유다).
  //
  // "N 번 안 보이면 포기"도 검토했지만 채택하지 않았다. 그 둘을 **횟수로는 구분할 수 없어서**,
  // 늦게 뜨는 정상 분석의 완료를 오히려 놓치게 된다 — 이 표시를 도입한 이유가 바로 그 완료를
  // 잡기 위해서였다. 감시를 조금 낭비하는 쪽이 완료를 잃는 쪽보다 낫다.
  if (startedId !== null && !items.some((item) => item.id === startedId)) {
    inFlightIds.push(startedId);
  }

  const inFlightKey = inFlightIds.sort().join(",");

  useEffect(() => {
    if (!inFlightKey) return;
    // 전경 로드와 겹치지 않게 한다 — 겹치면 응답 역전으로 상태가 되돌아간다.
    if (paused) return;
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
  }, [inFlightKey, rearmEpoch, paused]);

  return { rearm };
}

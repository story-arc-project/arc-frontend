"use client";

// FRT-107: "이 흐름을 끝내지 못하고 떠났는가".
//
// 퍼널로 파생할 수 있는 이탈은 여기 오지 않는다 — 두 이벤트 사이의 단순 미도달은
// PostHog 퍼널이 코드 없이, 그것도 과거 데이터까지 소급해서 답한다. 이 훅이 필요한 경우는
// **한 화면 안에서** 멈춘 것이라 퍼널이 구조적으로 볼 수 없을 때뿐이다(입력 폼, 온보딩 스텝).
//
// 탭 전환(hidden)은 이탈로 치지 않는다. 체류시간과 갈리는 지점이다 — 탭을 옮겼다고 폼을
// 포기한 건 아니고, 돌아와서 마저 쓰는 일이 흔하다.
import { useCallback, useRef } from "react";

import { useExitSignal } from "./exit-signal";

export interface FlowExitOptions {
  // 흐름이 시작됐는가. 데이터를 아직 못 불러온 화면을 이탈로 세지 않으려면 false 로 둔다.
  active: boolean;
  // 완료하지 못한 채 떠났을 때 1회. seconds 는 흐름 시작부터의 경과(숨어 있던 시간 포함) —
  // 체류가 아니라 "포기까지 얼마나 붙들고 있었나"라서 벽시계로 센다.
  onExit: (elapsedSeconds: number) => void;
}

export interface FlowExitResult {
  // 흐름이 완료됐음을 알린다. 이 뒤로는 언마운트·pagehide 어느 쪽에서도 발화하지 않는다.
  markCompleted: () => void;
  // 흐름 시작부터의 경과(초). 완료 이벤트에 소요시간을 실을 때 쓴다 —
  // 이탈 이벤트의 elapsed_seconds 와 같은 시계여야 둘을 나란히 놓고 비교할 수 있다.
  elapsedSeconds: () => number;
}

export function useFlowExit({ active, onExit }: FlowExitOptions): FlowExitResult {
  // 완료 판정은 발화 시점에 읽혀야 한다 — state 로 두면 언마운트 클로저가 옛 값을 굳힌다.
  const completedRef = useRef(false);

  const shouldFire = useCallback(() => !completedRef.current, []);

  // 흐름이 새로 시작되면 완료 표식도 함께 비운다. 안 비우면 한 번 저장한 인스턴스가
  // 그 뒤 다루는 모든 흐름을 "이미 완료"로 봐서 이탈을 영영 안 쏜다 — 시계는 새로
  // 잡히는데 판정만 옛것이 남는, 눈에 안 보이는 어긋남이다.
  const handleStart = useCallback(() => {
    completedRef.current = false;
  }, []);

  const { elapsedSeconds } = useExitSignal({
    active,
    onHidden: false,
    shouldFire,
    onFire: onExit,
    onStart: handleStart,
  });

  const markCompleted = useCallback(() => {
    completedRef.current = true;
  }, []);

  return { markCompleted, elapsedSeconds };
}

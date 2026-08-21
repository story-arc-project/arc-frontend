"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * 지금 내용이 차지하는 높이로 칸을 맞춘다.
 *
 * 먼저 `height="auto"` 로 리셋하는 것이 핵심이다. `scrollHeight` 는 내용 높이와 현재 높이 중
 * 큰 값이라, 리셋 없이 재면 한 번 커진 칸이 영영 안 줄어든다.
 */
function syncHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  // `box-sizing: border-box`(Tailwind preflight 가 전역으로 건다) 아래서 `style.height` 는 테두리까지
  // 포함하는 값인데 `scrollHeight` 는 테두리를 빼고 잰다. 그대로 넣으면 테두리 두께만큼 칸이 모자라
  // 마지막 줄이 `overflow-hidden` 에 잘린다 — 테두리를 되돌려 준다(테두리 없는 칸이면 0이라 무해).
  const { borderTopWidth, borderBottomWidth } = getComputedStyle(el);
  const borders = (parseFloat(borderTopWidth) || 0) + (parseFloat(borderBottomWidth) || 0);
  el.style.height = `${el.scrollHeight + borders}px`;
}

/**
 * 내용 높이에 맞춰 textarea 를 늘린다 — 칸 안에서 스크롤하는 대신 칸이 자란다.
 *
 * 제어 컴포넌트 전제다. `value` 가 바뀔 때마다 다시 재는데, 마운트 직후 첫 렌더도 이 effect 가
 * 함께 커버한다(layout effect 는 첫 렌더 뒤에도 페인트 전에 돈다) — 저장된 긴 값을 불러와도
 * 처음부터 펼쳐져 있다. 그래서 `onChange` 안에서 따로 부를 필요가 없다:
 * 입력 → 부모 상태 갱신 → 리렌더 → `value` 변경 → 이 effect, 로 다음 페인트 전에 높이가 맞는다.
 *
 * 높이를 바꾸는 것은 `value` 만이 아니다. **글자 수가 그대로여도 칸이 좁아지면 줄바꿈이 늘어난다**
 * (창 크기 변경·반응형 브레이크포인트·접혀 있던 영역이 펼쳐지며 생기는 리플로우). 이때 다시 재지
 * 않으면 높이가 옛 값에 머무는데, 이 칸들은 `overflow-hidden` 이라 스크롤바조차 없이 조용히 잘린다.
 * 그래서 `ResizeObserver` 로 너비 변화를 따로 듣는다.
 *
 * 전제: 마운트 시점에 요소가 레이아웃에 있어야 한다. `display:none` 안에서 마운트하면
 * `scrollHeight` 가 0이라 높이가 붕괴한다. CSS `min-height` 는 이 리셋과 무관하게 살아 있으므로
 * 최소 높이는 클래스로 정하면 된다.
 */
export function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    syncHeight(el);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    // SSR·구형 환경 방어. 없으면 `value` 기준 측정만 남고 리플로우 보정이 빠질 뿐, 나머지는 그대로 돈다.
    if (!el || typeof ResizeObserver === "undefined") return;

    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      // 자기 자신을 보고 있으므로 방금 우리가 준 **높이** 변경도 이 콜백을 다시 부른다.
      // 너비가 그대로면 줄바꿈도 그대로라 다시 잴 이유가 없다 — 이 가드가 되먹임 루프를 끊는다.
      if (width === lastWidth) return;
      lastWidth = width;
      syncHeight(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

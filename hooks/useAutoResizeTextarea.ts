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
 * **`value` 만 높이를 바꾸는 게 아니다.** 글자가 그대로여도 *같은 글자가 다르게 접히면* 높이가 변한다.
 * 그런 일이 일어나는 축이 둘이라 각각 따로 듣는다 — 어느 쪽이든 다시 재지 않으면 높이가 옛 값에
 * 머무는데, 이 칸들은 `overflow-hidden` 이라 스크롤바조차 없이 조용히 잘린다.
 *
 * 1. **칸의 너비** — 창 크기 변경·반응형 브레이크포인트·접혀 있던 영역이 펼쳐지며 생기는 리플로우.
 * 2. **글자의 너비** — 웹폰트가 늦게 도착해 대체 글꼴을 밀어내는 순간. 너비도 `value` 도 그대로인데
 *    글리프 폭만 바뀌어 줄 수가 달라진다.
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

  // (1) 칸의 너비가 바뀌면 다시 잰다.
  useEffect(() => {
    const el = ref.current;
    // SSR·구형 환경 방어. 없으면 `value` 기준 측정만 남고 리플로우 보정이 빠질 뿐, 나머지는 그대로 돈다.
    if (!el || typeof ResizeObserver === "undefined") return;

    // `observe()` 직후 현재 크기로 콜백이 한 번 오므로, 기준값은 그때 잡는다.
    // 여기서 미리 재면 소용없는 강제 리플로우만 하나 늘고 정수/소수 단위도 어긋난다.
    let lastWidth: number | null = null;
    const observer = new ResizeObserver(entries => {
      // 옵저버가 준 **소수점** 너비를 그대로 본다. `clientWidth` 는 정수로 반올림돼, 줄바꿈 경계를
      // 넘나드는 0.x px 변화가 같은 정수로 뭉개지면 이 가드가 진짜 변화를 삼킨다.
      const width = entries[entries.length - 1]?.contentRect.width;
      if (width === undefined) return;
      // 자기 자신을 보고 있으므로 방금 우리가 준 **높이** 변경도 이 콜백을 다시 부른다.
      // 너비가 그대로면 줄바꿈도 그대로라 다시 잴 이유가 없다 — 이 가드가 되먹임 루프를 끊는다.
      if (width === lastWidth) return;
      lastWidth = width;
      syncHeight(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // (2) 글자의 너비가 바뀌면 — 웹폰트가 대체 글꼴을 밀어내면 — 다시 잰다.
  useEffect(() => {
    const el = ref.current;
    // jsdom·SSR·구형 브라우저에는 `document.fonts` 가 아예 없다. 없으면 이 보정만 빠진다.
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!el || !fonts) return;

    let alive = true;
    const remeasure = () => {
      if (alive) syncHeight(el);
    };

    // 동적 서브셋 폰트는 새 글리프가 필요해질 때마다 조각을 더 받는다 — 교체가 한 번으로 끝나지 않는다.
    fonts.addEventListener("loadingdone", remeasure);
    // 구독하기 전에 이미 로딩이 끝났을 수도 있다. `ready` 가 그 창을 닫는다.
    fonts.ready.then(remeasure).catch(() => {});

    return () => {
      alive = false;
      fonts.removeEventListener("loadingdone", remeasure);
    };
  }, []);

  return ref;
}

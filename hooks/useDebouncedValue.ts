"use client";

import { useEffect, useState } from "react";

// FRT-16: 값이 delayMs 동안 잠잠해질 때까지 갱신을 미룬다. 고객 검색창이 타이핑마다 서버를
// 때리지 않도록 검색어를 디바운스하는 데 쓴다(리포 최초 debounce). 순수 로직 → TDD.
//
// delayMs 가 바뀌면 진행 중 타이머를 버리고 새 지연으로 다시 잡는다.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

"use client";

import { useEffect, useState } from "react";

/**
 * `[data-section-id]` 요소들을 IntersectionObserver 로 관찰해 현재 활성 섹션 id 를 반환한다.
 * ids 변경·요소 마운트에 따라 재구독. IO 미지원/요소 부재 시 첫 id 폴백.
 */
export function useScrollspy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (ids.length === 0) { setActive(null); return; }
    setActive(prev => (prev && ids.includes(prev) ? prev : ids[0]));

    if (typeof IntersectionObserver === "undefined") return;
    const els = ids
      .map(id => document.querySelector<HTMLElement>(`[data-section-id="${id}"]`))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const id = e.target.getAttribute("data-section-id");
          if (!id) continue;
          if (e.isIntersecting) visible.set(id, e.intersectionRatio);
          else visible.delete(id);
        }
        // 현재 보이는 섹션 중 ids 순서상 가장 앞선 것을 활성화
        const current = ids.find(id => visible.has(id));
        if (current) setActive(current);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: [0, 0.1, 0.5, 1] }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return active;
}

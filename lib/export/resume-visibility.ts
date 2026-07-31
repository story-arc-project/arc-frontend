import type { DisplayControl } from "@/types/resume";

/**
 * FRT-207 rev.5 — 경험형 섹션에서 **1쪽에 실릴 항목만** 골라 표시순위대로 돌려준다.
 *
 * 생성기(`_apply_page_budget()`)가 1쪽 예산을 계산해 경험마다 `표시`·`표시순위`를 얹는다.
 * 예산을 넘긴 항목은 삭제되지 않고 `표시=false` 로 남으므로, 1쪽을 만드는 일은
 * **프론트가 이 필드를 읽어 거르는 것**이다.
 *
 * ⚠️ 백엔드는 아직 이 필드를 내지 않는다(arc-backend 전 브랜치 미구현). 그래서 규칙의 핵심은
 * **아무 항목에도 `표시`가 없으면 필터를 통째로 끄고 입력을 그대로 돌려주는 것**이다 —
 * 없는 필드를 "false" 로 읽으면 지금 있는 레쥬메가 전부 빈 화면이 된다.
 * 일부 항목에만 붙어 있을 때도 숨기는 근거는 명시적인 `표시: false` 뿐이다.
 *
 * 고정 영역(학력·어학·자격증·수상·기술및역량·기타정보)에는 쓰지 않는다 — rev.5 명세상
 * 예산 조정 대상이 아니라 항상 렌더된다.
 */
export function visibleExperiences<T extends DisplayControl>(
  items: T[] | null | undefined,
): T[] {
  if (!items || items.length === 0) return [];

  const tagged = items.some((item) => item?.표시 !== undefined);
  if (!tagged) return items;

  return items
    .filter((item) => item?.표시 !== false)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * 표시순위가 없는 항목은 뒤로 민다. 0 으로 두면 순위 1번보다 앞서므로 쓸 수 없고,
 * 순위는 1부터 부여되니 `Infinity` 로 밀고 원래 순서는 인덱스 타이브레이커가 지킨다.
 */
function rank(item: DisplayControl): number {
  return typeof item?.표시순위 === "number" ? item.표시순위 : Number.POSITIVE_INFINITY;
}

// FRT-86: 미리보기를 연 채 이웃 기록으로 넘어가기 위한 순수 판정.
// 목록(마스터)의 현재 순서를 그대로 따르므로 인자는 화면에 렌더된 순서의 id 배열이다.

export type PeerDirection = "prev" | "next"

/**
 * 목록 순서에서 현재 항목의 이전/다음 id 를 돌려준다. 이동할 곳이 없으면 null.
 *
 * 순환하지 않는다 — 첫 항목의 prev 와 마지막 항목의 next 는 null 이다.
 * 현재 id 가 목록에 없으면(검색·필터 변경으로 이탈) 기준점이 없으므로 양방향 모두 null 이다.
 */
export function getPeerId(
  ids: string[],
  currentId: string | null,
  direction: PeerDirection,
): string | null {
  if (currentId === null) return null

  const index = ids.indexOf(currentId)
  if (index === -1) return null

  const target = direction === "prev" ? index - 1 : index + 1
  return ids[target] ?? null
}

/**
 * 키보드 이벤트 판정 유틸 (FRT-172).
 *
 * 한글 등 IME 입력에서 마지막 음절을 확정하려고 누르는 Enter 는 조합 확정용이고,
 * 그 keydown 은 `nativeEvent.isComposing === true` 로 도착한다. 이 Enter 를 값 커밋으로
 * 오인하면 조합이 끝나지 않은 텍스트가 그대로 커밋된다.
 *
 * 판정은 이 파일 한 곳에만 둔다 — 입력칸마다 가드를 복제하면 새 입력칸에서 또 빠진다
 * (실제로 태그·옵션·열 이름 등 17곳 중 OutcomeList 한 곳에만 방어가 있었다).
 */

import type { KeyboardEvent } from "react"

/**
 * IME(한글 등) 조합 중인 keydown 인가.
 *
 * Enter 외에 Escape·Backspace 등 다른 키까지 함께 다루는 핸들러는 `onEnterCommit` 대신
 * 이 판정을 핸들러 맨 앞의 early-return 으로 쓴다. 조합 중에는 어떤 키도 값 조작을
 * 트리거하면 안 된다 — 조합 중 Escape 는 조합 취소용이고, Backspace 는 음소 삭제용이다.
 */
export function isImeComposing(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing
}

/**
 * `Enter 로 값 커밋` 표준 onKeyDown 핸들러를 만든다.
 *
 * 조합 중 Enter 는 무시하고, 실제 커밋할 때만 기본 동작(form submit)을 막는다.
 * Enter 가 아닌 키는 그대로 흘려보낸다.
 */
export function onEnterCommit<T extends Element = Element>(commit: () => void) {
  return (e: KeyboardEvent<T>) => {
    if (isImeComposing(e)) return
    if (e.key !== "Enter") return
    e.preventDefault()
    commit()
  }
}

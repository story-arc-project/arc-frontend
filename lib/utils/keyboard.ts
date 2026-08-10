/**
 * 키보드 이벤트 판정 유틸 (FRT-172).
 *
 * 한글 등 IME 입력에서 마지막 음절을 확정하려고 누르는 Enter 는 조합 확정용이고,
 * 그 keydown 은 `nativeEvent.isComposing === true` 로 도착한다. 이 Enter 를 값 커밋으로
 * 오인하면 조합이 끝나지 않은 텍스트가 그대로 커밋된다.
 *
 * 단 WebKit(Safari·iOS)은 `compositionend` 를 `keydown` 보다 **먼저** 보내므로 그 Enter 가
 * 이미 `isComposing === false` 로 도착한다. 그래서 `isComposing` 하나로는 macOS·iOS 에서
 * 판정이 통째로 무력해진다. 그쪽에서 조합 신호로 남는 것은 레거시 `keyCode 229` 뿐이다.
 *
 * 판정은 이 파일 한 곳에만 둔다 — 입력칸마다 가드를 복제하면 새 입력칸에서 또 빠진다
 * (실제로 태그·옵션·열 이름 등 17곳 중 OutcomeList 한 곳에만 방어가 있었다).
 */

import type { KeyboardEvent } from "react"

/** IME 가 키 입력을 가로챘음을 알리는 레거시 keyCode. WebKit 은 조합 확정 Enter 를 이 값으로 보낸다. */
const IME_PROCESS_KEY_CODE = 229

/**
 * IME(한글 등) 조합 중인 keydown 인가.
 *
 * Enter 외에 Escape·Backspace 등 다른 키까지 함께 다루는 핸들러는 `onEnterCommit` 대신
 * 이 판정을 핸들러 맨 앞의 early-return 으로 쓴다. 조합 중에는 어떤 키도 값 조작을
 * 트리거하면 안 된다 — 조합 중 Escape 는 조합 취소용이고, Backspace 는 음소 삭제용이다.
 */
export function isImeComposing(e: KeyboardEvent): boolean {
  // 229 는 "IME 가 이 키를 처리했다"는 표식이라 조합 확정 단계에만 실린다. IME 를 켜 두기만 하고
  // 조합이 없을 때의 Enter 는 13 으로 와서 정상 커밋된다 — 두 번째 Enter 가 막히지 않는다.
  return e.nativeEvent.isComposing || e.nativeEvent.keyCode === IME_PROCESS_KEY_CODE
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

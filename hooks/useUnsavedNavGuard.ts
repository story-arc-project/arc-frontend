"use client"

import { useCallback, useEffect, useRef } from "react"

// sentinel history 엔트리를 식별하는 태그. Next.js 는 pushState 를 패치해 내부 라우터
// state(__NA·tree)를 우리 state 객체에 복사하지만 우리 키는 보존하므로, 이 태그로 "지금
// 최상단 엔트리가 우리 sentinel 인지"를 history.state 에서 직접 판정할 수 있다.
function armSentinel(): void {
  // Next.js 의 패치된 pushState 는 전달한 state 객체를 변형(내부 __NA·tree 추가)하므로
  // 매번 새 리터럴을 넘긴다(공유 객체 오염 방지).
  window.history.pushState({ __navGuardSentinel: true }, "")
}
function isSentinel(): boolean {
  return Boolean(
    (window.history.state as { __navGuardSentinel?: boolean } | null)
      ?.__navGuardSentinel,
  )
}

interface UseUnsavedNavGuardOptions {
  /** 가드 활성 여부(= 미저장 변경 있음). */
  enabled: boolean
  /** 브라우저 Back(popstate) 감지 시 호출 — 페이지가 이탈 가드 모달을 띄운다. */
  onAttemptLeave: () => void
  /** '나가기' 확정 시 실제 이동 — 보통 router.replace(backTo). */
  onLeave: () => void
}

/**
 * 미저장 상태에서의 이탈을 가드한다(FRT-81).
 *
 * Next.js App Router 에는 in-app 이동을 가로채는 useBlocker 가 없다. 그래서:
 * - full unload(새로고침·탭 닫기·주소창 이동) → `beforeunload`
 * - 브라우저 Back(SPA popstate) → history sentinel + popstate 리스너로 가로챔
 *
 * 동작: enabled 면 같은 URL 의 sentinel 엔트리를 push(arm)한다. Back 을 누르면 sentinel
 * 이 pop 되며(같은 URL 이라 폼은 언마운트되지 않음) popstate 가 발화 → 즉시 sentinel 을
 * 재-arm 해 페이지에 머문 채 `onAttemptLeave()` 로 모달을 띄운다. `confirmLeave()` 는
 * bypass 후 history.back() 으로 sentinel 을 pop 하고, 그 popstate 에서 `onLeave()` 만
 * 호출해 실제로 이전 페이지로 이동한다. (replace 사용 시 입력 라우트가 forward history 에
 * 남지 않아 이중 엔트리가 생기지 않는다.)
 *
 * arm 멱등성: sentinel 은 history.state 태그로 식별한다. enabled 가 true 로 바뀔 때마다
 * "최상단이 살아있는 sentinel 인지" 확인해, 있으면 건너뛰고(StrictMode 이중 마운트·재구독)
 * 없으면 push 한다. 따라서 dirty→clean→(clean Back 으로 sentinel pop)→dirty 시퀀스에서도
 * 태그가 사라진 걸 감지해 반드시 재-arm 한다(불리언 플래그로는 stale 위험).
 *
 * 범위 밖: GNB 등 셸 밖 SPA 링크는 전역 dirty 신호가 필요하므로 가드하지 않는다.
 *
 * 알려진 한계(데이터 소실 아님):
 * - arm 은 enabled 가 true 로 바뀐 뒤 effect 에서 일어나므로, 첫 dirty 입력과 arm 사이
 *   1프레임 남짓의 틈이 있다(그 사이 Back 은 사람 손으로는 도달 불가). 동기 dirty 감지는
 *   폼 책임이라 범위 밖.
 * - confirmLeave 를 거치지 않고 disarm 되는 경로(저장 성공 후 router.push·기타 unmount)에선
 *   sentinel 엔트리 1개가 history 에 잔존할 수 있다. 저장 후 목록에서 Back 시 빈 입력
 *   라우트가 한 번 스칠 수 있으나 작성 내용 소실과 무관.
 */
export default function useUnsavedNavGuard({
  enabled,
  onAttemptLeave,
  onLeave,
}: UseUnsavedNavGuardOptions) {
  const bypassRef = useRef(false)
  // 최신 콜백을 ref 로 유지 → 효과 의존성을 [enabled] 로 고정(재구독·이중 sentinel 방지).
  const onAttemptLeaveRef = useRef(onAttemptLeave)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => {
    onAttemptLeaveRef.current = onAttemptLeave
    onLeaveRef.current = onLeave
  })

  useEffect(() => {
    if (!enabled) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    const onPopState = () => {
      if (bypassRef.current) {
        bypassRef.current = false
        onLeaveRef.current()
        return
      }
      // Back 이 sentinel 을 pop 했으므로 즉시 재-push 해 페이지에 머문다(net 1개 유지).
      armSentinel()
      onAttemptLeaveRef.current()
    }

    // 멱등 arm: 살아있는 sentinel 이 최상단일 때만 건너뛴다(StrictMode 이중 마운트엔 1개만,
    // dirty→clean→Back→dirty 로 sentinel 이 소거됐으면 다시 push).
    if (!isSentinel()) {
      armSentinel()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("popstate", onPopState)
    }
  }, [enabled])

  const confirmLeave = useCallback(() => {
    bypassRef.current = true
    window.history.back() // sentinel pop → popstate → onLeave()
  }, [])

  return { confirmLeave }
}

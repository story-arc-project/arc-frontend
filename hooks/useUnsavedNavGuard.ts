"use client"

import { useCallback, useEffect, useRef } from "react"

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
 * 범위 밖: GNB 등 셸 밖 SPA 링크는 전역 dirty 신호가 필요하므로 가드하지 않는다.
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
      window.history.pushState(null, "") // 재-arm: 페이지에 머묾
      onAttemptLeaveRef.current()
    }

    window.history.pushState(null, "") // arm
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

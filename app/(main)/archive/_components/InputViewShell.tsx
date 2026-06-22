"use client"

import { useEffect, useState } from "react"
import type { RefObject, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import type { ExperienceFormV2Handle } from "@/components/features/archive/ExperienceFormV2"
import SectionNav from "./SectionNav"

interface InputViewShellProps {
  /** 저장 트리거(초안/완료)를 노출하는 폼 핸들 ref */
  formRef: RefObject<ExperienceFormV2Handle | null>
  /** 폼이 onUnsavedChange 로 보고하는 미저장 여부 */
  hasUnsaved: boolean
  /** "목록으로"·이탈 확정 시 돌아갈 경로 (basePath 포함 완성형) */
  backTo: string
  /** 저장 진행 중 — 액션 버튼 비활성 */
  saving?: boolean
  /** 좌측 레일 섹션 네비에 표시할 섹션 목록 */
  sections: { id: string; label: string }[]
  children: ReactNode
}

/**
 * 입력 전용 라우트(`/archive/new`, `/archive/[id]/edit`)의 셸(chrome).
 *
 * - lg 이상: 2-컬럼 그리드 [220px 레일][콘텐츠]. 레일에 SectionNav(섹션 네비 + 저장/취소).
 * - lg 미만: 상단 sticky 바에 뒤로가기 + 초안 저장/완료 버튼.
 *
 * dirty-guard: Next.js App Router 에는 in-app router.push 를 가로채는 useBlocker 가
 * 없다. 그래서 "목록으로"(in-app 이동)는 아래 handleBack 이 직접 가드하고, 브라우저
 * back/refresh·탭 닫기 같은 full unload 는 beforeunload 로 커버한다. 단 GNB 등 셸 밖
 * 링크(SPA 이동)는 beforeunload 가 발화하지 않아 가드되지 않는다 — 전역 dirty 신호가
 * 필요하며 범위 밖(resume 페이지 선례와 동일).
 */
export default function InputViewShell({
  formRef,
  hasUnsaved,
  backTo,
  saving,
  sections,
  children,
}: InputViewShellProps) {
  const router = useRouter()
  const [showGuardModal, setShowGuardModal] = useState(false)

  useEffect(() => {
    if (!hasUnsaved) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsaved])

  function handleBack() {
    if (hasUnsaved) {
      setShowGuardModal(true)
      return
    }
    router.push(backTo)
  }

  function confirmDiscard() {
    setShowGuardModal(false)
    router.push(backTo)
  }

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* 좌측 레일 — lg 이상 */}
      <aside className="hidden lg:flex flex-col sticky top-[var(--gnb-h)] h-[calc(100dvh-var(--gnb-h))] border-r border-border px-4 py-6 overflow-y-auto">
        <button
          type="button"
          onClick={handleBack}
          aria-label="목록으로 돌아가기"
          className="flex items-center gap-1.5 text-label text-text-secondary hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          <span>목록으로</span>
        </button>
        <SectionNav sections={sections} formRef={formRef} saving={saving} />
      </aside>

      {/* 본문 */}
      <div className="flex flex-col min-w-0">
        {/* 상단바 — 모바일 저장/취소(lg 이상 숨김) + 뒤로가기(모바일) */}
        <header className="sticky top-[var(--gnb-h)] z-40 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={handleBack}
            aria-label="목록으로 돌아가기"
            className="flex items-center gap-1.5 text-label text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={16} />
            <span>목록으로</span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => formRef.current?.save("draft")}
            >
              초안 저장
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => formRef.current?.save("complete")}
            >
              완료
            </Button>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>

      {/* 미저장 이탈 가드 모달. */}
      <Dialog
        open={showGuardModal}
        onClose={() => setShowGuardModal(false)}
        ariaLabel="저장하지 않고 나갈까요?"
      >
        <h3 className="text-title text-text-primary mb-2">저장하지 않고 나갈까요?</h3>
        <p className="text-body-sm text-text-secondary mb-6 leading-relaxed">
          작성 중인 내용이 있어요. 나가면 사라져요.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowGuardModal(false)}>
            취소
          </Button>
          <Button variant="destructive" size="sm" onClick={confirmDiscard}>
            나가기
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

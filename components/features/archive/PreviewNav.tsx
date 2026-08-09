"use client"

import { ChevronDown, ChevronUp } from "lucide-react"

// FRT-86: 미리보기를 연 채 이웃 기록으로 넘어가는 버튼 쌍.
// 데스크톱(도킹 패널)·모바일(풀스크린 패널) 헤더가 같은 마크업을 복제하지 않도록 분리했다.
//
// 방향 아이콘이 좌우(‹ ›)가 아니라 상하(⌃ ⌄)인 것은 의도다 — 목록이 세로로 흐르므로
// 키보드 ↑/↓·k/j 와 버튼 방향이 1:1로 일치해야 "위=이전, 아래=다음"이 한 가지 뜻으로 읽힌다.
interface PreviewNavProps {
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  className?: string
}

// 헤더 바가 h-11(44px)이라 버튼도 바 높이를 꽉 채운다. 기존 ✕(p-1, 26px)보다 넓은 탭 영역이다.
const BUTTON_CLASS =
  "h-11 w-11 flex items-center justify-center rounded text-text-tertiary " +
  "transition-colors enabled:hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"

export default function PreviewNav({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  className = "",
}: PreviewNavProps) {
  return (
    <div role="group" aria-label="기록 이동" className={`flex items-center ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="이전 기록"
        title="이전 기록 (↑ 또는 K)"
        className={BUTTON_CLASS}
      >
        <ChevronUp size={18} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="다음 기록"
        title="다음 기록 (↓ 또는 J)"
        className={BUTTON_CLASS}
      >
        <ChevronDown size={18} />
      </button>
    </div>
  )
}

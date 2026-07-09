"use client"

import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import type { ExperienceFormV2Handle } from "@/components/features/archive/ExperienceFormV2"
import { useScrollspy } from "@/hooks/useScrollspy"

interface SectionNavProps {
  sections: { id: string; label: string }[]
  formRef: RefObject<ExperienceFormV2Handle | null>
  saving?: boolean
  /** 고정 카드 진행도(완료 카드 수/전체). total 이 0이면 바를 숨긴다. */
  progress?: { done: number; total: number }
}

export default function SectionNav({ sections, formRef, saving, progress }: SectionNavProps) {
  const active = useScrollspy(sections.map(s => s.id))

  function scrollTo(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      {progress && progress.total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary">작성 진행도</span>
            <span className="text-caption font-medium text-text-primary tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="작성 진행도"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      <nav aria-label="섹션 이동" className="flex flex-col gap-1">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            aria-current={active === s.id ? true : undefined}
            className={`text-left text-body-sm rounded-md px-3 py-2 transition-colors ${
              active === s.id
                ? "bg-surface-brand text-brand-dark font-medium"
                : "text-text-secondary hover:bg-surface-secondary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          variant="primary"
          size="sm"
          disabled={saving}
          onClick={() => formRef.current?.save("complete")}
          fullWidth
        >
          완료
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => formRef.current?.save("draft")}
          fullWidth
        >
          초안 저장
        </Button>
      </div>
    </div>
  )
}
